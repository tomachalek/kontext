# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

from util import as_async

class TreexTemplate:

    def __init__(self, id_list, tree_list, conf):
        self._id_list = id_list
        self._tree_list = tree_list
        self._conf = conf

    def _generate_desc(self):
        ans = []
        for item in self._tree_list[0]:  # TODO
            ans.append([item.word, item.id])
        return ans

    @as_async
    def export(self):
        sentence = ' '.join(n.word for n in self._tree_list[0])
        graph_list = []
        for i in range(len(self._id_list)):
            graph_list.append({
                'zones': {
                    'cs': {  # TODO
                        'trees': {
                            'default': {
                                'layer': self._conf[self._id_list[i]].layer_type,
                                'nodes': self._tree_list[0]
                            }
                        },
                        'sentence': sentence
                    }
                },
                'desc': self._generate_desc()
            })
        return graph_list


class UcnkTreeTemplate(TreexTemplate):

    def __init__(self, tree_id, tree_data, kwic_pos, conf):
        super(UcnkTreeTemplate, self).__init__([tree_id], [tree_data], conf)
        self._kwic_pos = list(range(kwic_pos[0], kwic_pos[0] + kwic_pos[1]))

    async def export(self):
        ans = await super(UcnkTreeTemplate, self).export()
        ans[0]['kwicPosition'] = self._kwic_pos
        return ans
