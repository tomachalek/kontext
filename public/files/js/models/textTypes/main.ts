/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import {TextTypes} from '../../types/common';
import {AjaxResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../base';
import {IPluginApi} from '../../types/plugins';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import rangeSelector = require('./rangeSelector');
import {TextInputAttributeSelection, FullAttributeSelection} from './valueSelections';
import { IActionDispatcher, Action } from 'kombo';


/**
 * Server-side data representing a single text types box (= a single [struct].[attr])
 * as returned by respective AJAX calls.
 */
export interface BlockLine {


    Values?:Array<{v:string; xcnt?:number}>;

    /**
     * Specifies a size (approx. in chars) of a text input
     * box required for this specific BlockLine. This is
     * Bonito-open approach but KonText still uses sthe
     * value to distinguish between enumerated items
     * and input-text ones.
     *
     * Please note that 'Values' and 'textboxlength' are
     * mutually exclusive.
     */
    textboxlength?:number;

    attr_doc:string;

    attr_doc_label:string;

    is_interval:number;

    label:string;

    name:string;

    numeric:boolean;
}

/**
 * Server-side data
 */
export interface Block {
    Line:Array<BlockLine>;
}


/**
 * Server-side data representing a group
 * of structures, structural attributes and
 * their values.
 *
 * Please note that for bib_attr, the initial
 * data is not expected to contain items IDs
 * which means that bibliography attribute box
 * model must be always an instance of
 * ./valueSelections.TextInputAttributeSelection
 * (otherwise a user would click on a label but
 * there would be no corresponding ID underneath)
 * On server, this is ensured by passing the
 * bib. attr. name to 'shrink_list' argument
 * (see lib/texttypes.py method export_with_norms())
 */
export interface InitialData {
    Blocks:Array<Block>;
    Normslist:Array<any>;
    bib_attr:string; // bib item label (possibly non-unique)
    id_attr:string; // actual bib item identifier (unique)
}


export interface SelectedTextTypes {
    [key:string]:Array<string>;
}


const typeIsSelected = (data:SelectedTextTypes, attr:string, v:string):boolean => {
    if (data.hasOwnProperty(attr)) {
        return data[attr].indexOf(v) > -1;
    }
    return false;
}


/**
 * Provides essential general operations on available text types
 * (filtering values, updating status - checked/locked, ...).
 *
 * All the state data is based on Immutable.js except for individual data
 * items which are updated via manual copying (i.e. no Immutable.Record).
 */
export class TextTypesModel extends StatefulModel implements TextTypes.ITextTypesModel,
        TextTypes.IAdHocSubcorpusDetector {

    private attributes:Immutable.List<TextTypes.AttributeSelection>;

    /**
     * A text type attribute which serves as a title (possibly non-unique)
     * of a bibliography item. The value can be undefined.
     */
    private bibLabelAttr:string;

    /**
     * A text type attribute which is able to uniquely determine a single document.
     * The value can be undefined (in such case we presume there are no bibliography
     * items present)
     */
    private bibIdAttr:string;

    /**
     * A list of selection snapshots generated by calling
     * the snapshotState() method. At least one item
     * (initial state) is always present.
     */
    private selectionHistory:Immutable.List<Immutable.List<TextTypes.AttributeSelection>>;

    /**
     * Select-all request flags
     */
    private selectAll:Immutable.Map<string, boolean>;

    /**
     * A helper class used to process range-like selection requests
     * (e.g. "select years between 1980 and 1990").
     */
    private rangeSelector:rangeSelector.RangeSelector;

    private pluginApi:IPluginApi;

    /**
     * Represents meta information related to the whole attribute
     * (i.e. not just to a single value).
     */
    private metaInfo:Immutable.Map<string, TextTypes.AttrSummary>;

    /**
     * Contains externally registered callbacks invoked in case
     * user clicks to the [i] icon. The model must be set to provide
     * such a functionality.
     */
    private extendedInfoCallbacks:Immutable.Map<string, (ident:string)=>RSVP.Promise<any>>; // TODO type

    /**
     * Contains externally registered callbacks invoked in case
     * user writes something to text-input based value selection boxes.
     * This can be used e.g. to provide auto-complete features.
     */
    private textInputChangeCallback:(attrName:string, inputValue:string)=>RSVP.Promise<any>;

    private selectionChangeListeners:Immutable.List<(target:TextTypes.ITextTypesModel)=>void>;

    private minimizedBoxes:Immutable.Map<string, boolean>;

    /**
     *
     */
    private textInputPlaceholder:string;

    private _isBusy:boolean;


    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, data:InitialData, selectedItems?:SelectedTextTypes) {
        super(dispatcher);
        this.attributes = Immutable.List(this.importInitialData(data, selectedItems || {}));
        this.bibLabelAttr = data.bib_attr;
        this.bibIdAttr = data.id_attr;
        this.selectionHistory = Immutable.List<Immutable.List<TextTypes.AttributeSelection>>();
        this.selectionHistory = this.selectionHistory.push(this.attributes);
        this.selectAll = Immutable.Map<string, boolean>(
                this.attributes.map(
                    (item:TextTypes.AttributeSelection)=>[item.name, false]
                ).toList());
        this.pluginApi = pluginApi;
        this.rangeSelector = new rangeSelector.RangeSelector(pluginApi, this);
        this.metaInfo = Immutable.Map<string, TextTypes.AttrSummary>();
        this.extendedInfoCallbacks = Immutable.Map<string, (ident:string)=>RSVP.Promise<any>>();
        this.selectionChangeListeners = Immutable.List<(target:TextTypes.ITextTypesModel)=>void>();
        this.textInputPlaceholder = null;
        this._isBusy = false;
        this.minimizedBoxes = Immutable.Map<string, boolean>(this.attributes.map(v => [v.name, false]));

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'TT_VALUE_CHECKBOX_CLICKED':
                    this.changeValueSelection(action.payload['attrName'], action.payload['itemIdx']);
                    break;
                case 'TT_SELECT_ALL_CHECKBOX_CLICKED':
                    this.applySelectAll(action.payload['attrName']);
                    break;
                case 'TT_RANGE_BUTTON_CLICKED':
                    this.applyRange(action.payload['attrName'], action.payload['fromVal'],
                            action.payload['toVal'], action.payload['strictInterval'],
                            action.payload['keepCurrent']);
                    break;
                case 'TT_TOGGLE_RANGE_MODE':
                    this.setRangeMode(action.payload['attrName'], !this.getRangeModes().get(action.payload['attrName']));
                    this.emitChange();
                    break;
                case 'TT_EXTENDED_INFORMATION_REQUEST':
                    this._isBusy = true;
                    this.emitChange();
                    this.fetchExtendedInfo(action.payload['attrName'], action.payload['ident']).then(
                        (v) => {
                            this._isBusy = false;
                            this.emitChange();
                        },
                        (err) => {
                            this._isBusy = false;
                            this.pluginApi.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                    break;
                case 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST':
                    this.clearExtendedInfo(action.payload['attrName'], action.payload['ident']);
                    this.emitChange();
                    break;
                case 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED':
                    this.setTextInputAttrValue(action.payload['attrName'], action.payload['ident'],
                            action.payload['label'], action.payload['append']);
                    this.emitChange();
                    break;
                case 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED':
                    this.handleAttrTextInputChange(action.payload['attrName'], action.payload['value']);
                    this.emitChange();
                    break;
                case 'TT_ATTRIBUTE_AUTO_COMPLETE_RESET':
                    this.resetAutoComplete(action.payload['attrName']);
                    this.emitChange();
                    break;
                case 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST':
                    this.handleAttrTextInputAutoCompleteRequest(action.payload['attrName'], action.payload['value']).then(
                        (v) => {
                            this.emitChange();
                        },
                        (err) => {
                            this.pluginApi.showMessage('error', err);
                            console.error(err);
                        }
                    );
                    break;
                case 'TT_MINIMIZE_ALL':
                    this.minimizedBoxes = this.minimizedBoxes.map((v, k) => true).toMap();
                    this.emitChange();
                break;
                case 'TT_MAXIMIZE_ALL':
                    this.minimizedBoxes = this.minimizedBoxes.map((v, k) => false).toMap();
                    this.emitChange();
                break;
                case 'TT_TOGGLE_MINIMIZE_ITEM':
                    this.minimizedBoxes = this.minimizedBoxes.set(
                        action.payload['ident'],
                        !this.minimizedBoxes.get(action.payload['ident'])
                    );
                    this.emitChange();
                break;
            }
        });
    }

    applyCheckedItems(checkedItems:TextTypes.ServerCheckedValues, bibMapping:TextTypes.BibMapping):void {
        Object.keys(checkedItems).forEach(k => {
            const attrIdx = this.attributes.findIndex(v => k === this.bibIdAttr ? v.name === this.bibLabelAttr : v.name === k);
            if (attrIdx === -1) {
                console.warn(`Cannot apply checked value for ${k}`);
                return;
            }
            let attr = this.attributes.get(attrIdx);
            // now we must distinguish 4 cases:
            // [structattr box is configured as bibliography list] x [structattr box is a list of items or a text input box]
            if (attr.name === this.bibLabelAttr) {
                if (attr instanceof TextInputAttributeSelection) {
                    checkedItems[k].forEach(checkedVal => {
                        attr = (<TextInputAttributeSelection>attr).addValue({
                            ident: checkedVal,
                            value: checkedVal in bibMapping ? bibMapping[checkedVal] : checkedVal,
                            selected: true,
                            locked: false,
                            numGrouped: 0
                        });
                    });
                    this.attributes = this.attributes.set(attrIdx, attr);

                } else {
                    this.attributes = this.attributes.set(attrIdx, attr.mapValues(item => {
                        return {
                            ident: item.ident,
                            value: item.ident in bibMapping ? bibMapping[item.ident] : item.value,
                            selected: checkedItems[k].indexOf(item.value) > -1 ? true : false,
                            locked: false,
                            availItems: item.availItems,
                            numGrouped: item.numGrouped,
                            extendedInfo: item.extendedInfo
                        }
                    }));
                }

            } else {
                if (attr instanceof TextInputAttributeSelection) {
                    checkedItems[k].forEach(checkedVal => {
                        attr = (<TextInputAttributeSelection>attr).addValue({
                            ident: checkedVal,
                            value: checkedVal,
                            selected: true,
                            locked: false,
                            numGrouped: 0
                        });
                    });
                    this.attributes = this.attributes.set(attrIdx, attr);

                } else {
                    this.attributes = this.attributes.set(attrIdx, attr.mapValues(item => {
                        return {
                            ident: item.ident,
                            value: item.value,
                            selected: checkedItems[k].indexOf(item.value) > -1 ? true : false,
                            locked: false,
                            availItems: item.availItems,
                            numGrouped: item.numGrouped,
                            extendedInfo: item.extendedInfo
                        }
                    }));
                }
            }
        });
    }


    private clearExtendedInfo(attrName:string, ident:string):void {
        const attr = this.getAttribute(attrName);
        if (attr) {
            const attrIdx = this.attributes.indexOf(attr);
            const newAttr = attr.setExtendedInfo(ident, null);
            this.attributes = this.attributes.set(attrIdx, newAttr);

        } else {
            throw new Error('Attribute not found: ' + attrName);
        }
    }

    private fetchExtendedInfo(attrName:string, ident:string):RSVP.Promise<any> {
        const attr = this.getAttribute(attrName);
        const attrIdx = this.attributes.indexOf(attr);
        const srchIdx = attr.getValues().findIndex(v => v.ident === ident);
        if (srchIdx > - 1 && attr.getValues().get(srchIdx).numGrouped < 2) {
            this.attributes = this.attributes.set(attrIdx, attr.mapValues(item => {
                return {
                    availItems: item.availItems,
                    extendedInfo: undefined,
                    ident: item.ident,
                    locked: item.locked,
                    numGrouped: item.numGrouped,
                    selected: item.selected,
                    value: item.value
                };
            }));
            const fn = this.extendedInfoCallbacks.get(attrName);
            if (fn) {
                return fn(ident);

            } else {
                return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                    resolve(null);
                });
            }

        } else if (srchIdx > -1) {
            const message = this.pluginApi.translate(
                    'query__tt_multiple_items_same_name_{num_items}',
                    {num_items: attr.getValues().get(srchIdx).numGrouped}
            );
            this.setExtendedInfo(attrName, ident, Immutable.Map({__message__: message}));
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                resolve(null);
            });

        } else {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                reject(null);
            });
        }
    }

    private resetAutoComplete(attrName:string):void {
        const attr = this.getTextInputAttribute(attrName);
        if (attr) {
            const idx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(idx, attr.resetAutoComplete());
        }
    }

    private handleAttrTextInputChange(attrName:string, value:string) {
        const attr = this.getTextInputAttribute(attrName);
        if (attr) {
            const idx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(idx, attr.setTextFieldValue(value));
        }
    }

    private hasAutoCompleteSupport():boolean {
        return typeof this.textInputChangeCallback === 'function';
    }

    private handleAttrTextInputAutoCompleteRequest(attrName:string, value:string):RSVP.Promise<any> {
        if (this.hasAutoCompleteSupport()) {
            return this.textInputChangeCallback(attrName, value);

        } else {
            return RSVP.Promise.resolve(null);
        }
    }

    private setTextInputAttrValue(attrName:string, ident:string, label:string, append:boolean):void {
        const attr:TextTypes.AttributeSelection = this.getTextInputAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        const newVal:TextTypes.AttributeValue = {
            ident: ident,
            value: label,
            selected: true,
            locked: false,
            numGrouped: 1
        };
        const updatedAttr = append ? attr.addValue(newVal) : attr.clearValues().addValue(newVal);
        this.attributes = this.attributes.set(idx, updatedAttr);
        this.selectionChangeListeners.forEach(fn => fn(this));
    }

    private importInitialData(data:InitialData, selectedItems:SelectedTextTypes):Array<TextTypes.AttributeSelection> {
        const mergedBlocks:Array<BlockLine> = data.Blocks.reduce((prev:Array<BlockLine>, curr:Block) => {
            return prev.concat(curr.Line);
        }, []);
        if (mergedBlocks.length > 0) {
            return mergedBlocks.map((attrItem:BlockLine) => {
                if (attrItem.textboxlength) {
                    // TODO restore selected items also here (must load labels first...)
                    return new TextInputAttributeSelection(
                        attrItem.name,
                        attrItem.label,
                        attrItem.numeric,
                        !!attrItem.is_interval,
                        {
                            doc: attrItem.attr_doc,
                            docLabel: attrItem.attr_doc_label
                        },
                        '',
                        Immutable.List([]), Immutable.List([]));

                } else {
                    const values:Array<TextTypes.AttributeValue> = attrItem.Values.map(
                        (valItem:{v:string, xcnt:number}) => {
                            return {
                                value: valItem.v,
                                ident: valItem.v, // TODO what about bib items?
                                selected: typeIsSelected(selectedItems, attrItem.name, valItem.v) ? true : false,
                                locked:false,
                                availItems:valItem.xcnt,
                                numGrouped: 1 // TODO here we expect that initial data do not have any name duplicities
                            };
                        }
                    );
                    return new FullAttributeSelection(
                        attrItem.name,
                        attrItem.label,
                        attrItem.numeric,
                        !!attrItem.is_interval,
                        {
                            doc: attrItem.attr_doc,
                            docLabel: attrItem.attr_doc_label
                        },
                        Immutable.List(values)
                    );
                }
            });
        }
        return null;
    }

    syncFrom(fn:()=>RSVP.Promise<AjaxResponse.QueryFormArgs>):RSVP.Promise<AjaxResponse.QueryFormArgs> {
        return fn().then(
            (data) => {
                this.applyCheckedItems(data.selected_text_types, data.bib_mapping);
                return new RSVP.Promise<AjaxResponse.QueryFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(data);
                    }
                );
            }
        );
    }

    private changeValueSelection(attrIdent:string, itemIdx:number):void {
        const attr = this.getAttribute(attrIdent);
        const idx = this.attributes.indexOf(attr);
        if (attr) {
            this.attributes = this.attributes.set(idx, attr.toggleValueSelection(itemIdx));
            this.selectionChangeListeners.forEach(fn => fn(this));

        } else {
            throw new Error('no such attribute value: ' + attrIdent);
        }
        this.emitChange();
    }

    // TODO move notify... out of the method
    private applyRange(attrName:string, fromVal:number, toVal: number, strictInterval:boolean,
            keepCurrent:boolean):void {
        const prom = this.rangeSelector.applyRange(attrName, fromVal, toVal, strictInterval, keepCurrent);
        prom.then(
            (newSelection:TextTypes.AttributeSelection) => {
                this.selectionChangeListeners.forEach(fn => fn(this));
                this.emitChange();
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    private applySelectAll(ident:string) {
        const item = this.getAttribute(ident);
        const idx = this.attributes.indexOf(item);
        if (item.containsFullList()) {
            this.selectAll = this.selectAll.set(ident, !this.selectAll.get(ident));
            const newVal = this.selectAll.get(ident);
            this.attributes = this.attributes.set(idx, item.mapValues((item) => {
                return {
                    ident: item.ident,
                    value: item.value,
                    selected: newVal,
                    locked: item.locked,
                    numGrouped: item.numGrouped,
                    availItems: item.availItems
                };
            }));
            this.selectionChangeListeners.forEach(fn => fn(this));
            this.emitChange();
        }
    }

    snapshotState():void {
        this.selectionHistory = this.selectionHistory.push(this.attributes);
    }

    undoState():void {
        this.selectionHistory = this.selectionHistory.pop();
        this.attributes = this.selectionHistory.last();
    }

    canUndoState():boolean {
        return this.selectionHistory.size > 1;
    }

    addSelectionChangeListener(fn:(target:TextTypes.ITextTypesModel)=>void):void {
        this.selectionChangeListeners = this.selectionChangeListeners.push(fn);
    }

    reset():void {
        this.attributes = this.selectionHistory.get(0);
        this.selectionHistory = this.selectionHistory.slice(0, 1).toList();
        this.selectAll = this.selectAll.map((item)=>false).toMap();
        this.metaInfo = this.metaInfo.clear();
        this.selectionChangeListeners.forEach(fn => fn(this));
    }

    getAttribute(ident:string):TextTypes.AttributeSelection {
        return this.attributes.find((val) => val.name === ident);
    }

    getAttrSize(attrName:string):number {
        const item = this.attributes.find(item => item.name === attrName);
        if (item) {
            return item.getValues().reduce((prev, curr) => prev + curr.availItems, 0);
        }
        return -1;
    }

    getTextInputAttribute(ident:string):TextTypes.ITextInputAttributeSelection {
        const ans = this.attributes.find(val => val.name === ident);
        if (ans instanceof TextInputAttributeSelection) {
            return ans;
        }
        return undefined;
    }

    replaceAttribute(ident:string, val:TextTypes.AttributeSelection):void {
        const attr = this.getAttribute(ident);
        const idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, val);

        } else {
            throw new Error('Failed to find attribute ' + ident);
        }
    }

    getAttributes():Array<TextTypes.AttributeSelection> {
        return this.attributes.toArray();
    }

    getInitialAvailableValues(attrName:string):Immutable.List<TextTypes.AttributeValue> {
        const idx = this.selectionHistory.get(0).findIndex(item => item.name === attrName);
        if (idx > -1) {
            return this.selectionHistory.get(0).get(idx).getValues().map(item => item).toList();
        }
        return Immutable.List<TextTypes.AttributeValue>();
    }

    exportSelections(lockedOnesOnly:boolean):{[attr:string]:Array<string>} {
        const ans = {};
        this.attributes.forEach((attrSel:TextTypes.AttributeSelection) => {
            if (attrSel.hasUserChanges()) {
                if (this.hasAutoCompleteSupport()) {
                    ans[attrSel.name !== this.bibLabelAttr ? attrSel.name : this.bibIdAttr] = attrSel.exportSelections(lockedOnesOnly);

                } else {
                    if (attrSel instanceof TextInputAttributeSelection) {
                        ans[attrSel.name] = [attrSel.getTextFieldValue()];

                    } else {
                        ans[attrSel.name] = attrSel.exportSelections(lockedOnesOnly);
                    }
                }
            }
        });
        return ans;
    }

    updateItems(attrName:string, items:Array<string>):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, attr.updateItems(items));
        }
    }

    filter(attrName:string, fn:(v:TextTypes.AttributeValue)=>boolean):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, attr.filter(fn));
        }
    }

    mapItems(attrName:string, mapFn:(v:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            const newAttr = attr.mapValues(mapFn);
            this.attributes = this.attributes.set(idx, newAttr);
        }
    }

    setValues(attrName:string, values:Array<string>):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        const values2:Array<TextTypes.AttributeValue> = values.map((item:string) => {
            return {
                ident: item, // TODO what about bib items?
                value: item,
                selected: false,
                locked: false,
                numGrouped: 1 // TODO is it always OK here?
            };
        });
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, attr.setValues(values2));

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    /**
     * This applies only for TextInputAttributeSelection boxes. In other
     * cases the function has no effect.
     */
    setAutoComplete(attrName:string, values:Array<TextTypes.AutoCompleteItem>):void {
        const attr = this.getTextInputAttribute(attrName);
        if (attr) {
            let idx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(idx, attr.setAutoComplete(values));
        }
    }

    hasSelectedItems(attrName?:string):boolean {
        if (attrName !== undefined) {
            const attr = this.getAttribute(attrName);
            if (attr) {
                return attr.hasUserChanges();

            } else {
                throw new Error('Failed to find attribute ' + attrName);
            }

        } else {
            return this.getAttributes().some(item => item.hasUserChanges());
        }
    }

    usesAdHocSubcorpus():boolean {
        return this.hasSelectedItems();
    }

    getAttributesWithSelectedItems(includeLocked:boolean):Array<string> {
        return this.attributes.filter((item:TextTypes.AttributeSelection) => {
            return item.hasUserChanges() && (!item.isLocked() || includeLocked);
        }).map((item:TextTypes.AttributeSelection)=>item.name).toArray();
    }

    setAttrSummary(attrName:string, value:TextTypes.AttrSummary):void {
        this.metaInfo = this.metaInfo.set(attrName, value);
    }

    getAttrSummary():Immutable.Map<string, TextTypes.AttrSummary> {
        return this.metaInfo;
    }

    setExtendedInfoSupport<T>(attrName:string, fn:(ident:string)=>RSVP.Promise<T>):void {
        this.extendedInfoCallbacks = this.extendedInfoCallbacks.set(attrName, fn);
    }

    hasDefinedExtendedInfo(attrName:string):boolean {
        return this.extendedInfoCallbacks.has(attrName);
    }

    setExtendedInfo(attrName:string, ident:string, data:Immutable.Map<string, any>):void {
        let attr = this.getAttribute(attrName);
        if (attrName) {
            let attrIdx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(attrIdx, attr.setExtendedInfo(ident, data));

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    setTextInputChangeCallback(fn:(attrName:string, inputValue:string)=>RSVP.Promise<any>):void {
        this.textInputChangeCallback = fn;
    }


    setTextInputPlaceholder(s:string):void {
        this.textInputPlaceholder = s;
    }

    getTextInputPlaceholder():string {
        return this.textInputPlaceholder;
    }

    setRangeMode(attrName:string, rangeIsOn:boolean) {
        this.rangeSelector.setRangeMode(attrName, rangeIsOn);
    }

    getRangeModes():Immutable.Map<string, boolean> {
        return this.rangeSelector.getRangeModes();
    }

    isBusy():boolean {
        return this._isBusy;
    }

    getMiminimizedBoxes():Immutable.Map<string, boolean> {
        return this.minimizedBoxes;
    }

    hasSomeMaximizedBoxes():boolean {
        return this.minimizedBoxes.find(v => v === false) !== undefined;
    }

}