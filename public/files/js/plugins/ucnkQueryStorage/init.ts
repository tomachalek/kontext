/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import RSVP = require('vendor/rsvp');


function splitString(s: string, maxChunkSize: number): Array<HTMLElement> {
    let ans:Array<HTMLElement> = [];
    let items:Array<string> = s.split(/([\s,\."':\-\(\)\|])/);
    let newItem:HTMLElement;
    let line = '';

    while (items.length > 0) {
        if (line.length + items[0].length <= maxChunkSize) {
            line += items.shift();

        } else if (line.length > 0) {
            if (ans.length > 0) {
                ans.push(document.createElement('br'))
            }
            newItem = document.createElement('span');
            $(newItem).text(line);
            ans.push(newItem);
            line = '';

        } else {
            line += items.shift().substr(0, maxChunkSize - 3) + '&hellip;';
        }
    }
    if (line.length > 0) {
        if (ans.length > 0) {
            ans.push(document.createElement('br'));
        }
        newItem = document.createElement('span');
        $(newItem).text(line);
        ans.push(newItem);
    }

    return ans;
}

/**
 *
 */
export interface QueryHistoryRecord {
    corpname: string;
    subcorpname: string;
    query_type: string;
    query_type_translated: string;
    humanCorpname: string;
    url: string;
    query: string;
    details: string;
}

/**
 * A widget to extend CQL query input field by a pop-up box containing user's query history.
 */
export class QueryHistory {

    queryHistoryPlugin:QueryStoragePlugin;

    inputElm:JQuery;

    parentElm:JQuery;

    boxElm:JQuery;

    triggerButton:JQuery;

    highlightedRow:number;

    data:Array<any>;

    dependencies:Array<Kontext.Closeable>;

    pluginApi:Kontext.PluginApi;

    splitQueryIfSize:number = 60;

    alignedCorpSuffix:string;

    /**
     *
     * @param inputElm
     * @param parentElm
     */
    constructor(queryHistoryPlugin:QueryStoragePlugin, pluginApi: Kontext.PluginApi, inputElm: HTMLElement,
            parentElm: HTMLElement, alignedCorpSuffix:string='') {
        this.queryHistoryPlugin = queryHistoryPlugin;
        this.pluginApi = pluginApi;
        this.inputElm = $(inputElm);
        this.parentElm = $(parentElm);
        this.boxElm = null;
        this.triggerButton = null;
        this.inputElm.attr('autocomplete', 'off');
        this.highlightedRow = 0;
        this.data = []; // currently appended data
        this.dependencies = []; // list of registered external dependencies (see function registerDependency())
        this.alignedCorpSuffix = alignedCorpSuffix;
        this.bindOnOffEvents();
    }

    /**
     * @param refElm
     */
    calcSizeAndPosition(refElm: HTMLElement):{width:number; height: number; top: number; left: number} {
        let jqRef:JQuery = $(refElm);

        return {
            width : jqRef.width(),
            height : jqRef.outerHeight(),
            top : jqRef.position().top,
            left : jqRef.position().left
        };
    }

    /**
     *
     */
    inputVisible(): boolean {
        return this.inputElm.is(':visible');
    }

    /**
     *
     */
    numRows(): number {
        return this.data ? this.data.length : 0;
    }

    /**
     *
     * @param val
     */
    setInputVal(val: string): void {
        this.inputElm.val(val);
    }

    /**
     *
     */
    popup(): void {
        if (!this.isActive()) {
            this.init();
        }
    }

    /**
     *
     */
    bindOnOffEvents(): void {
        let self = this;

        $(window).on('keydown.queryStoragePlugin', function (event) {
            if (event.keyCode === 13 && self.isActive()) { // ENTER key
                self.updateForm(self.getSelectedRow());
                event.preventDefault();
                event.stopPropagation();
                self.close();

            } else if (event.keyCode === 27 && self.isActive()) { // ESC key
                event.preventDefault();
                event.stopPropagation();
                self.close();

            } else if (event.keyCode === 40 && self.inputVisible()
                && !self.isActive() && self.inputHasFocus()) { // DOWN arrow
                self.popup();
            }
        });
    }

    /**
     *
     */
    bindEvents(): void {
        let self = this;

        this.inputElm.on('keydown.queryStoragePluginMoveSelection', function (event) {
            if (event.keyCode === 38) { // UP arrow
                self.highlightPrevRow();

            } else if (event.keyCode === 40 && self.isActive()) { // DOWN arrow
                self.highlightNextRow();
            }
        });

        this.boxElm.find('.filter-checkbox').on('click', function (event) {
            if ($(event.currentTarget).is(':checked')) {
                self.boxElm.find('.rows li').each(function () {
                    if ($(this).data('corpname') !== self.pluginApi.getConf('corpname')) {
                        $(this).hide();
                    }
                });

            } else {
                self.boxElm.find('.rows li').each(function () {
                    if ($(this).data('corpname') !== self.pluginApi.getConf('corpname')
                        && !$(this).is(':visible')) {
                        $(this).show();
                    }
                });
            }
        });

        function windowClickHandler(event) {
            if (self.boxElm && self.boxElm.find(event.target).length === 0
                    && !self.boxElm.is(event.target)
                    && !self.triggerButton.is(event.target)) {
                $(window.document).off('click.closeHistoryWidget', windowClickHandler);
                self.close();
            }
        }
        $(window.document).on('click.closeHistoryWidget', windowClickHandler);

        // we have to block main form Enter key event to prevent submission
        this.queryHistoryPlugin.lockParentFormSubmit();
    }

    /**
     *
     * @param triggerElm
     */
    updateForm(triggerElm: HTMLElement): void {
        let jqTriggerElm:JQuery = $(triggerElm);
        let self = this;

        this.setInputVal(this.data[this.highlightedRow].query);
        if (jqTriggerElm.attr('data-subcorpname')) {
            $('#subcorp-selector').val(jqTriggerElm.attr('data-subcorpname'));

        } else {
            $('#subcorp-selector').val(null); // we must reset subcorpus
        }
        if (jqTriggerElm.attr('data-query-type')) {
            (function (queryType) {
                let newType = queryType + 'row';
                let selectElm = $('#queryselector' + self.alignedCorpSuffix);

                // it's important to set the select-box's value only
                // if the new value is different than the current one;
                // otherwise, the form is messed-up
                if (selectElm.val() !== newType) {
                    selectElm.val(newType);
                    $('#queryselector').change(); // to trigger proper event
                }
            }(jqTriggerElm.attr('data-query-type')));
        }
    }

    /**
     *
     */
    cleanRowSelection(): void {
        this.boxElm.find('ol.rows li').removeClass('selected');
    }

    /**
     *
     * @returns {HTMLElement}
     */
    getSelectedRow(): HTMLElement {
        return this.boxElm.find('ol.rows li:nth-child(' + (this.highlightedRow + 1) + ')').get(0);
    }

    /**
     *
     */
    highlightCurrentRow(): void {
        this.cleanRowSelection();
        let rowElm = $(this.getSelectedRow());
        if (this.data.length > 0) {
            rowElm.addClass('selected');
        }
    }

    /**
     *
     */
    highlightNextRow(): void {
        if (this.highlightedRow < this.numRows() - 1) {
            this.highlightedRow += 1;
            this.highlightCurrentRow();
        }
    }

    /**
     *
     */
    highlightPrevRow(): void {
        if (this.highlightedRow > 0) {
            this.highlightedRow -= 1;
            this.highlightCurrentRow();
        }
    }

    /**
     * @param {Closeable} dep
     */
    registerDependency<T extends Kontext.Closeable>(dep:T): void {
        if (typeof dep.close !== 'function') {
            throw new Error('Registered dependency must implement close() method');
        }
        this.dependencies.push(dep);
    }

    /**
     *
     */
    closeDependencies(): void {
        for (let i:number = 0; i < this.dependencies.length; i += 1) {
            try {
                this.dependencies[i].close();
            } catch (e) {
                console.error('error closing dependency: ', e);
            }
        }
    }

    /**
     *
     */
    init():void {
        let self = this;

        if (this.data.length === 0) {
            if (this.inputElm.val()) {
                this.data.push({
                    query : this.inputElm.val(),
                    query_type : $('#queryselector option:selected').data('type'),
                    corpname : self.pluginApi.getConf('corpname'),
                    subcorpname : self.getCurrentSubcorpname(),
                    humanCorpname : self.pluginApi.getConf('humanCorpname')
                });
            }
            this.inputElm.blur();  // These two lines prevent Firefox from deleting
            this.inputElm.focus(); // the input after ESC is hit (probably a bug).

            this.pluginApi.ajax(
                'GET',
                this.pluginApi.createActionUrl('user/ajax_query_history'),
                {corpname: this.pluginApi.getConf('corpname')},
                {contentType : 'application/x-www-form-urlencoded'}

            ).then(
                (data:Kontext.AjaxResponse) => {
                    if (data.contains_errors) {
                        this.pluginApi.showMessage('error', data.messages[0]);

                    } else {
                        if (!this.boxElm) {
                            this.render();
                        }
                        self.showData(data['data']);
                    }
                },
                (err) => {
                    this.pluginApi.showMessage("error", err.statusText);
                }
            );

        } else { // data are already loaded - let's just reuse it
            if (!this.boxElm) {
                self.render();
            }
            this.showData();
        }
    }

    /**
     *
     */
    render(): void {
        let frame = this.calcSizeAndPosition(this.inputElm.get(0));
        let html = '<ol class="rows"></ol>'
            + '<div class="footer">'
            + '<label class="filter-current">'
            + this.pluginApi.translate('ucnkQS__only_current_corpus')
            + '<input class="filter-checkbox" type="checkbox" /></label>'
            + '</div>';

        this.boxElm = $(window.document.createElement('div'));
        this.boxElm.addClass('history-widget');
        $(this.parentElm).append(this.boxElm);
        this.boxElm.css({
            position : 'absolute',
            left : frame.left,
            width : frame.width
        });
        this.boxElm.html(html);
        this.bindEvents();
    }

    /**
     * Cleans-up currently rendered history rows and appends new data
     * as obtained in parameter 'data'. This method has a side effect
     * as it sets this.data to the new value. If no 'data' is provided
     * then current this.data value is used.
     *
     * @param {{}} [data]
     * @param {string} data.humanCorpname
     * @param {string} data.subcorpname
     * @param {string} data.corpname
     */
    showData(data?: Array<QueryHistoryRecord>): void {
        let tbl = this.boxElm.find('ol.rows');
        let self = this;

        if (typeof data !== 'undefined') {
            this.data = data;
        }
        tbl.empty();
        this.data.forEach((v:QueryHistoryRecord, i:number) => {
            let listItem = $(window.document.createElement('li'));
            listItem.attr('data-rownum', i);
            listItem.attr('data-corpname', v.corpname);
            listItem.attr('data-subcorpname', v.subcorpname);
            listItem.attr('data-query-type', v.query_type);

            let link = $(window.document.createElement('em'));
            link.append(splitString(self.pluginApi.shortenText(v.query,
                    self.pluginApi.getConf<number>('historyMaxQuerySize')), self.splitQueryIfSize));

            listItem.on('click', function (event) {
                self.highlightedRow = parseInt($(this).attr('data-rownum'), 10);
                self.highlightCurrentRow();
                self.updateForm(this);
                event.preventDefault();
                event.stopPropagation();
                self.close();
            });

            tbl.append(listItem);
            listItem.append(link);
            listItem.append('&nbsp;<span class="corpname">(' + v.query_type_translated
                + (v.details ? ', ' + v.details : '') + ')</span>');
            listItem.wrapInner('<span class="wrapper"></span>');
        });
        this.highlightCurrentRow();
    }

    /**
     * Closes history widget.
     */
    close():void {
        this.inputElm.off('keydown.queryStoragePluginMoveSelection');
        $(window.document).off('click.closeHistoryWidget');
        this.highlightedRow = 0;
        if (this.boxElm) {
            this.boxElm.remove();
            this.boxElm = null;
        }
        this.queryHistoryPlugin.unlockParentFormSubmit();
    }

    /**
     * @return ??
     */
    isActive():boolean {
        return this.boxElm !== null;
    }

    /**
     * @return
     */
    inputHasFocus():boolean {
        return this.inputElm.is(':focus');
    }

    /**
     *
     * @returns {val|*|val}
     */
    getCurrentSubcorpname():string {
        return $('#subcorp-selector').val();
    }

    /**
     *
     * @returns ??
     */
    getWrappingElement():JQuery {
        return this.parentElm;
    }

}


export class QueryStoragePlugin implements Plugins.IQueryStorage {

    pluginApi:Kontext.PluginApi;

    /**
     *
     * @param pluginApi
     */
    init(pluginApi:Kontext.PluginApi):void {
        this.pluginApi = pluginApi;
        this.reset();
    }

    /**
     * @param {Plugin} plugin
     */
    addTriggerButton(plugin:QueryHistory):void {
        if (plugin) {
            let liElm = $(window.document.createElement('li'));
            let aElm = $(window.document.createElement('a'));
            aElm
                .addClass('history')
                .css('text-transform', 'lowercase');
            plugin.getWrappingElement().find('.query-toolbox').append(liElm);
            plugin.triggerButton = aElm;
            liElm.append(aElm);
            aElm.append(this.pluginApi.translate('ucnkQS__recent_queries'));

            aElm.on('click', () => {
                if (plugin.isActive()) {
                    plugin.close();

                } else {
                    plugin.popup();
                }
            });
            plugin.registerDependency({
                element : liElm,
                close : () => $(liElm).remove()
            });
        }
    }

    lockParentFormSubmit():void {
        $('#make-concordance-button').prop('disabled', true);
        $('#mainform').on('submit.tmp-disable', (evt:JQueryEventObject) => {
            evt.preventDefault();
        });
    }

    unlockParentFormSubmit():void {
        $('#make-concordance-button').prop('disabled', false);
        $('#mainform').off('submit.tmp-disable');
    }

    /**
     * Binds the query history widget to a passed element (typically, this is an input elm)
     *
     * @param elm
     * @returns {Plugin}
     */
    bind(elm:HTMLElement, alignedCorpSuffix:string): QueryHistory {
        if (Object.prototype.toString.call(this.pluginApi) !== '[object Object]') {
            throw new Error('Plugin [ucnkQueryStorage] not initialized. Please call init() first.');
        }
        let queryStorage = new QueryHistory(this, this.pluginApi, elm, $(elm).parent().get(0), alignedCorpSuffix);
        $(elm).data('plugin', queryStorage);

        return queryStorage;
    }


    /**
     * Detaches plugin instance from provided element.
     * All the event handlers are removed too.
     *
     * @param {jQuery|HTMLElement} elm
     */
    detach(elm): void {
        let jqElm:JQuery = $(elm);

        if (jqElm.data('plugin') !== null && typeof jqElm.data('plugin') === 'object') {
            jqElm.data('plugin').close();
            jqElm.data('plugin').closeDependencies();
            $(window).off('keydown.queryStoragePlugin');
            jqElm.data('plugin', null);
        }
    }

    reset(): void {
        if (!this.pluginApi.userIsAnonymous()) {
            let inputSrch = 'input.history:visible,textarea.history:visible';
            $('#mainform').find('table.primary-language .query-area').find(inputSrch)
                .each((_, elm:HTMLElement) => {
                    this.addTriggerButton(this.bind(elm, ''));
                });
            $('#mainform').find('.parallel-corp-lang').each((_, item) => {
                let corpSuffix = '_' + $(item).attr('data-corpus-id');
                $(item).find('.query-area').find(inputSrch)
                    .each((_, elm:HTMLElement) => {
                        this.addTriggerButton(this.bind(elm, corpSuffix));
                    });
            });
        }
    }
}

/**
 * Creates uninitialized plug-in object
 *
 * @returns {QueryStoragePlugin}
 */
export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Plugins.IQueryStorage> {
    return new RSVP.Promise((resolve:(ans:Plugins.IQueryStorage)=>void, reject:(e:any)=>void)=> {
        let plugin = new QueryStoragePlugin();
        plugin.init(pluginApi);
        resolve(plugin);
    });
}

