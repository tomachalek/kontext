/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

import React from 'vendor/react';
import {init as defaultViewInit} from '../defaultCorparch/corplistView';


export function init(dispatcher, mixins, layoutViews, CorpusInfoBox, formStore, listStore) {
    const defaultComponents = defaultViewInit(dispatcher, mixins, layoutViews, CorpusInfoBox,
            formStore, listStore);

    const he = mixins[0];

    /**
     *
     */
    const RequestForm = React.createClass({
        mixins: mixins,

        _submitHandler : function () {
            dispatcher.dispatch({
                actionType: 'CORPUS_ACCESS_REQ_SUBMITTED',
                props: {
                    corpusId: this.props.corpusId,
                    corpusName: this.props.corpusName,
                    customMessage: this.state.customMessage
                }
            });
            this.props.submitHandler();
        },

        _textareaChangeHandler : function (e) {
            this.setState({customMessage: e.target.value});
        },

        getInitialState : function () {
            return {customMessage: ''};
        },

        render : function () {
            return (
                <form>
                    <img className="message-icon" src={this.createStaticUrl('img/message-icon.png')}
                            alt={this.translate('ucnkCorparch__message_icon')} />
                    <p>{this.translate('ucnkCorparch__please_give_me_access_{corpname}',
                        {corpname: this.props.corpusName})}</p>
                    <label className="hint">
                        {this.translate('ucnkCorparch__custom_message')}:
                    </label>
                    <div>
                        <textarea rows="3" cols="50"
                                onChange={this._textareaChangeHandler}
                                value={this.state.customMessage} />
                    </div>
                    <div>
                        <button className="submit" type="button"
                                onClick={this._submitHandler}>{this.translate('ucnkCorparch__send')}</button>
                    </div>
                </form>
            );
        }

    });

    /**
     *
     */
    const LockIcon = React.createClass({
        mixins: mixins,

        getInitialState : function () {
            return {isUnlockable: this.props.isUnlockable, hasFocus: false, hasDialog: false};
        },

        _mouseOverHandler : function () {
            this.setState({isUnlockable: this.state.isUnlockable, hasFocus: true, hasDialog: this.state.hasDialog});
        },

        _mouseOutHandler : function () {
            this.setState({isUnlockable: this.state.isUnlockable, hasFocus: false, hasDialog: this.state.hasDialog});
        },

        _clickHandler : function () {
            this.setState({isUnlockable: this.state.isUnlockable, hasFocus: this.state.hasFocus, hasDialog: true});
        },

        _closeDialog : function () {
            const newState = he.cloneState(this.state);
            newState.hasDialog = false;
            this.setState(newState);
        },

        _renderDialog : function () {
            if (this.state.hasDialog) {
                const onBoxReady = function (elm) {
                    let rect = elm.getBoundingClientRect();
                    let newX, newY;

                    newX = (document.documentElement.clientWidth - rect.width) / 2;
                    newY = document.documentElement.clientHeight / 2;
                    elm.style.left = newX;
                    elm.style.top = newY;
                };
                return (
                    <layoutViews.PopupBox onCloseClick={this._closeDialog}
                        customClass="corpus-access-req" onReady={onBoxReady} >
                        <div>
                            <RequestForm submitHandler={this._closeDialog}
                                corpusId={this.props.corpusId}
                                corpusName={this.props.corpusName} />
                        </div>
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        },

        render : function () {
            if (this.state.isUnlockable) {
                const img = this.state.hasFocus ? <img src={this.createStaticUrl('img/unlocked.svg')} /> :
                        <img src={this.createStaticUrl('img/locked.svg')} />;

                return (
                    <div>
                        <div className="lock-status"
                                title={this.translate('ucnkCorparch__click_to_ask_access')}
                                onMouseOver={this._mouseOverHandler}
                                onMouseOut={this._mouseOutHandler}
                                onClick={this._clickHandler}>
                            {img}
                        </div>
                        {this._renderDialog()}
                    </div>
                );

            } else {
                return false;
            }
        }
    });

    /**
     * A single dataset row
     */
    const CorplistRow = (props) => {

        const handleDetailClick = (corpusId, evt) => {
            props.detailClickHandler(corpusId);
        };
        const keywords = props.row.keywords.map((k, i) => {
            return <defaultComponents.CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
        });
        const link = he.createActionLink('first_form', [['corpname', props.row.id]]);
        const size = props.row.size_info ? props.row.size_info : '-';

        let userAction = null;
        let corpLink;
        if (props.enableUserActions) {
            if (props.row.requestable) {
                corpLink = <span className="inaccessible">{props.row.name}</span>;
                userAction = <LockIcon isUnlockable={props.row.requestable}
                                    corpusId={props.row.id}
                                    corpusName={props.row.name} />;

            } else {
                corpLink = <a href={link}>{props.row.name}</a>;
                userAction = <defaultComponents.FavStar corpusId={props.row.id}
                                    corpusName={props.row.name}
                                    isFav={props.row.user_item} />;
            }

        } else {
            corpLink = <a href={link}>{props.row.name}</a>;
        }
        return (
            <tr>
                <td className="corpname">{corpLink}</td>
                <td className="num">{size}</td>
                <td>
                    {keywords}
                </td>
                <td>
                    {userAction}
                </td>
                <td>
                    <p className="desc" style={{display: 'none'}}></p>
                    <a className="detail"
                            onClick={handleDetailClick.bind(null, props.row.id)}>
                        {he.translate('defaultCorparch__corpus_details')}
                    </a>
                </td>
            </tr>
        );
    };

    /**
     * dataset table
     */
    const CorplistTable = React.createClass({

        changeHandler: function () {
            const data = listStore.getData();
            const detail = listStore.getDetail();
            this.setState({
                rows: data.rows,
                nextOffset: data.nextOffset,
                detailVisible: !!detail,
                detail: detail
            });
        },

        getInitialState: function () {
            return {
                rows: this.props.rows,
                nextOffset: this.props.nextOffset,
                detailVisible: false,
                detail: null
            };
        },

        componentDidMount: function () {
            listStore.addChangeListener(this.changeHandler);
        },

        componentWillUnmount: function () {
            listStore.removeChangeListener(this.changeHandler);
        },

        _detailClickHandler: function (corpusId) {
            const newState = he.cloneState(this.state);
            newState.detailVisible = true;
            this.setState(newState);
            dispatcher.dispatch({
                actionType: 'CORPARCH_CORPUS_INFO_REQUIRED',
                props: {
                    corpusId: corpusId
                }
            });
        },

        _detailCloseHandler: function () {
            const newState = he.cloneState(this.state);
            newState.detailVisible = false;
            this.setState(newState);
            dispatcher.dispatch({
                actionType: 'CORPARCH_CORPUS_INFO_CLOSED',
                props: {}
            });
        },

        _renderDetailBox: function () {
            if (this.state.detailVisible) {
                return (
                    <layoutViews.PopupBox
                        onCloseClick={this._detailCloseHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                        <CorpusInfoBox data={this.state.detail} />
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        },

        render: function () {
            let rows = this.state.rows.map((row, i) => {
                return <CorplistRow key={row.id} row={row}
                                    enableUserActions={!this.props.anonymousUser}
                                    detailClickHandler={this._detailClickHandler} />;
            });
            let expansion = null;
            if (this.state.nextOffset) {
                expansion = <ListExpansion offset={this.state.nextOffset} />;
            }

            return (
                <div>
                    {this._renderDetailBox()}
                    <table className="data corplist">
                        <tbody>
                            <defaultComponents.CorplistHeader />
                            {rows}
                            {expansion}
                        </tbody>
                    </table>
                </div>
            );
        }
    });

    /**
     * Provides a link allowing to load more items with current
     * query and filter settings.
     */
    const ListExpansion = (props) => {

        const linkClickHandler = () => {
            dispatcher.dispatch({
                actionType: 'EXPANSION_CLICKED',
                props: {
                    offset: props.offset
                }
            });
        };

        return (
            <tr className="load-more">
                <td colSpan="5">
                    <a onClick={linkClickHandler}>{he.translate('ucnkCorparch__load_all')}</a>
                </td>
            </tr>
        );
    };

    return {
        CorplistTable: CorplistTable,
        FilterForm: defaultComponents.FilterForm
    };
}
