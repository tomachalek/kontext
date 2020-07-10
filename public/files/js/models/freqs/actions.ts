/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Action } from 'kombo';
import { ResultBlock } from './dataRows';
import { MultiDict } from '../../multidict';
import { SaveData } from '../../app/navigation';
import { Dimensions, FreqFilterQuantities, AlignTypes } from './twoDimension/common';
import { Maths } from 'cnc-tskit';
import { FreqQuantities } from './twoDimension/generalDisplay';
import { ColorMappings } from './twoDimension/table2d';


export enum ActionName {
    ResultSetMinFreqVal = 'FREQ_RESULT_SET_MIN_FREQ_VAL',
    ResultApplyMinFreq = 'FREQ_RESULT_APPLY_MIN_FREQ',
    ResultDataLoaded = 'FREQ_RESULT_DATA_LOADED',
    ResultSortByColumn = 'FREQ_RESULT_SORT_BY_COLUMN',
    ResultSetCurrentPage = 'FREQ_RESULT_SET_CURRENT_PAGE',
    ResultCloseSaveForm = 'FREQ_RESULT_CLOSE_SAVE_FORM',
    ResultPrepareSubmitArgsDone = 'FREQ_RESULT_PREPARE_SUBMIT_ARGS_DONE',
    SaveFormSetFormat = 'FREQ_SAVE_FORM_SET_FORMAT',
    SaveFormSetFromLine = 'FREQ_SAVE_FORM_SET_FROM_LINE',
    SaveFormSetToLine = 'FREQ_SAVE_FORM_SET_TO_LINE',
    SaveFormSetIncludeHeading = 'FREQ_SAVE_FORM_SET_INCLUDE_HEADING',
    SaveFormSetIncludeColHeading = 'FREQ_SAVE_FORM_SET_INCLUDE_COL_HEADERS',
    SaveFormSubmit = 'FREQ_SAVE_FORM_SUBMIT',
    SetCtSaveMode = 'FREQ_CT_SET_SAVE_MODE',
    FreqctFormSetDimensionAttr = 'FREQ_CT_FORM_SET_DIMENSION_ATTR',
    FreqctFormSetMinFreqType = 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE',
    FreqctFormSetMinFreq = 'FREQ_CT_FORM_SET_MIN_FREQ',
    FreqctFormSetCtx = 'FREQ_CT_FORM_SET_CTX',
    FreqctFormSetAlignType = 'FREQ_CT_FORM_SET_ALIGN_TYPE',
    FreqctFormSubmit = 'FREQ_CT_SUBMIT',
    FreqctSetAlphaLevel = 'FREQ_CT_SET_ALPHA_LEVEL',
    FreqctSetMinFreq = 'FREQ_CT_SET_MIN_FREQ',
    FreqctSetEmptyVecVisibility = 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY',
    FreqctTransposeTable = 'FREQ_CT_TRANSPOSE_TABLE',
    FreqctSortByDimension = 'FREQ_CT_SORT_BY_DIMENSION',
    FreqctSetDisplayQuantity = 'FREQ_CT_SET_DISPLAY_QUANTITY',
    FreqctSetColorMapping = 'FREQ_CT_SET_COLOR_MAPPING',
    FreqctSetHighlightedGroup = 'FREQ_CT_SET_HIGHLIGHTED_GROUP'
}


export namespace Actions {

    export interface ResultSetMinFreqVal extends Action<{
        value:string;
    }> {
        name: ActionName.ResultSetMinFreqVal;
    }

    export interface ResultApplyMinFreq extends Action<{
    }> {
        name: ActionName.ResultApplyMinFreq;
    }

    export interface ResultDataLoaded extends Action<{
        data:Array<ResultBlock>;
        resetPage:boolean;
    }> {
        name: ActionName.ResultDataLoaded;
    }

    export interface ResultSortByColumn extends Action<{
        value:string;
    }> {
        name: ActionName.ResultSortByColumn;
    }

    export interface ResultSetCurrentPage extends Action<{
        value:string;
    }> {
        name: ActionName.ResultSetCurrentPage;
    }

    export interface ResultCloseSaveForm extends Action<{
    }> {
        name: ActionName.ResultCloseSaveForm;
    }

    export interface ResultPrepareSubmitArgsDone extends Action<{
        data:MultiDict;
    }> {
        name: ActionName.ResultPrepareSubmitArgsDone;
    }

    export interface SaveFormSetFormat extends Action<{
        value:SaveData.Format;
    }> {
        name: ActionName.SaveFormSetFormat;
    }

    export interface SaveFormSetFromLine extends Action<{
        value:string;
    }> {
        name: ActionName.SaveFormSetFromLine;
    }

    export interface SaveFormSetToLine extends Action<{
        value:string;
    }> {
        name: ActionName.SaveFormSetToLine;
    }

    export interface SaveFormSetIncludeHeading extends Action<{
        value:boolean;
    }> {
        name: ActionName.SaveFormSetIncludeHeading;
    }

    export interface SaveFormSetIncludeColHeading extends Action<{
        value:boolean;
    }> {
        name: ActionName.SaveFormSetIncludeColHeading;
    }

    export interface SaveFormSubmit extends Action<{
    }> {
        name: ActionName.SaveFormSubmit;
    }

    export interface SetCtSaveMode extends Action<{
        value:string;
    }> {
        name: ActionName.SetCtSaveMode;
    }

    export interface FreqctFormSetDimensionAttr extends Action<{
        dimension:Dimensions;
        value:string;
    }> {
        name: ActionName.FreqctFormSetDimensionAttr;
    }

    export interface FreqctFormSetMinFreqType extends Action<{
        value:FreqFilterQuantities;
    }> {
        name: ActionName.FreqctFormSetMinFreqType;
    }

    export interface FreqctFormSetMinFreq extends Action<{
        value:string;
    }> {
        name: ActionName.FreqctFormSetMinFreq;
    }

    export interface FreqctFormSetCtx extends Action<{
        dim:Dimensions;
        value:number;
    }> {
        name: ActionName.FreqctFormSetCtx;
    }

    export interface FreqctFormSetAlignType extends Action<{
        dim:Dimensions;
        value:AlignTypes;
    }> {
        name: ActionName.FreqctFormSetAlignType;
    }

    export interface FreqctFormSubmit extends Action<{
    }> {
        name: ActionName.FreqctFormSubmit;
    }

    export interface FreqctSetAlphaLevel extends Action<{
        value:Maths.AlphaLevel;
    }> {
        name: ActionName.FreqctSetAlphaLevel;
    }

    export interface FreqctSetMinFreq extends Action<{
        value:string;
    }> {
        name: ActionName.FreqctSetMinFreq;
    }

    export interface FreqctSetEmptyVecVisibility extends Action<{
        value:boolean;
    }> {
        name: ActionName.FreqctSetEmptyVecVisibility;
    }

    export interface FreqctTransposeTable extends Action<{
    }> {
        name: ActionName.FreqctTransposeTable;
    }

    export interface FreqctSortByDimension extends Action<{
        dim:Dimensions;
        attr:string;
    }> {
        name: ActionName.FreqctSortByDimension;
    }

    export interface FreqctSetDisplayQuantity extends Action<{
        value:FreqQuantities;
    }> {
        name: ActionName.FreqctSetDisplayQuantity;
    }

    export interface FreqctSetColorMapping extends Action<{
        value:ColorMappings;
    }> {
        name: ActionName.FreqctSetColorMapping;
    }

    export interface FreqctSetHighlightedGroup extends Action<{
        value:[number, number];
    }> {
        name: ActionName.FreqctSetHighlightedGroup;
    }
}