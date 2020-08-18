# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

from plugins.abstract.query_suggest import AbstractBackend
import logging
from typing import List
from plugins.common.http import HTTPClient
import json


class WordSimilarityBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        self._client = HTTPClient(server=conf['server'], port=conf['port'], ssl=conf['ssl'])

    def get_required_attrs(self):
        if 'posAttrs' in self._conf:
            logging.getLogger(__name__).warning(
                'You are using a deprecated "conf.posAttr" value; please use "conf.attrs" instead.')
            return self._conf.get('posAttrs', [])
        else:
            return self._conf.get('attrs', [])

    def find_suggestion(self, ui_lang: str, corpora: List[str], subcorpus: str, value: str, query_type: str,
                        p_attr: str, struct: str, s_attr: str):
        args = dict()
        logging.getLogger(__name__).debug('HTTP Backend args: {0}'.format(args))
        path = '/'.join([self._conf['path'], 'corpora', self._conf['corpus'], 'similarWords',
                         self._conf['model'], self._client.enc_val(value)])
        logging.getLogger(__name__).debug('path: {}'.format(path))
        ans, is_found = self._client.request('GET', path, args, None)
        if is_found:
            return [v['word'] for v in json.loads(ans)]
        return []
