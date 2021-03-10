/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { BoundWithProps, IActionDispatcher } from 'kombo';
import { PqueryFormModelState } from '../../../models/pquery/common';
import { PqueryFormModel } from '../../../models/pquery/form';
import { Kontext } from '../../../types/common';
import { init as basicOverviewViewsInit } from '../../query/basicOverview';
import * as React from 'react';
import { Dict, List, pipe, Strings } from 'cnc-tskit';
import * as S from './style';


export interface OverviewProps {
    currCorpus:Kontext.FullCorpusIdent;
    queryId:string;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, model:PqueryFormModel):React.ComponentClass<OverviewProps> {

    const basicOverview = basicOverviewViewsInit(dispatcher, he);


    const Overview:React.FC<PqueryFormModelState & OverviewProps> = (props) => {

        return (
            <S.Overview>
                <basicOverview.EmptyQueryOverviewBar
                        corpname={props.currCorpus.id} foreignSubcorp={props.currCorpus.foreignSubcorp}
                        humanCorpname={props.currCorpus.name} origSubcorpName={props.currCorpus.origSubcorpName}
                        usesubcorp={props.currCorpus.usesubcorp}>
                    {props.queryId ?
                        <li>
                            {'\u00a0 | '}
                            <strong>{he.translate('pquery_overview_title')}: </strong>
                            <a className="args">{
                                pipe(
                                    props.queries,
                                    Dict.toEntries(),
                                    List.map(([,item]) => Strings.shortenText(item.query, 10)),
                                    List.join(() => ' && ')
                                )}</a>
                        </li> :
                        null
                    }
                </basicOverview.EmptyQueryOverviewBar>
            </S.Overview>
        );
    }

    return BoundWithProps<OverviewProps, PqueryFormModelState>(Overview, model);

}