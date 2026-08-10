import { defineComponent, reactive, onMounted, toRefs } from '../core/kniumvvm.mjs';

export const navController = defineComponent({
  setup({ root }) {
    const state = reactive({

    });

    onMounted(() => {
      var row = Math.ceil((top.innerHeight - 256 / 1080 * top.innerWidth) / 70);
      var myTable = kniu.table({
        el: root.querySelector('#tablegroup'),
        request: {
          type: 'POST',
          url: '/api/nav_list',
          current: 1,
          row: Math.max(1, row)
        },
        toolbar: [
          'filter',
          {
            content: '<div class="kniu_btn table_toolbar_add" data-table-event="add" title="添加">添加</div>'
          }
        ],
        cols: [
          {
            field: 'is_select',
            checkbox: true,
            width: 60,
            align: 'center',
            filter: false
          },
          {
            field: 'sid',
            title: '排序',
            sort: true,
            edit: 'text',
            width: 80,
            align: 'center'
          },
          {
            field: 'id',
            title: 'ID',
            sort: true,
            width: 80
          },
          {
            field: 'name',
            title: '栏目名称',
            width: 600
          },
          {
            field: 'is_show',
            title: '显示',
            width: 80,
            filter: false,
            content: function (items) {
              return `
                <div class="kniu_switch">
                  <input class="kniu_switch_input"
                  data-table-params="${items.data.id},${items.field}"
                  name="KNIU_TABLE_SWITCH"
                  value="${items.data[items.field]}" ${items.data[items.field] == 1 ? "checked" : ""}
                  type="checkbox">
                  <div class="kniu_switch_status">
                    <div class="kniu_switch_off">关</div>
                    <div class="kniu_switch_on">开</div>
                  </div>
                </div>
              `;
            }
          },
          {
            field: 'action',
            title: '操作',
            width: 200,
            filter: false,
            content: function (items) {
              return `
                <div class="kniu_table_operate_group">
                  <a class="kniu_table_operate table_operate_delete kniu_tips"
                    data-table-event="delete"
                    data-table-id="${items.data.id}"
                    href="javascript:;">
                    <span class="kniu_table_operate_icon kniu_icon kniu_icon_delete"></span>
                    <p class="kniu_table_operate_text">删除</p>
                  </a>
                  <a class="kniu_table_operate table_operate_update kniu_tips"
                    data-table-event="update"
                    data-table-id="${items.data.id}"
                    href="javascript:;">
                    <span class="kniu_table_operate_icon kniu_icon kniu_icon_square_edit"></span>
                    <p class="kniu_table_operate_text">修改</p>
                  </a>
                </div>
              `;
            }
          }
        ]
      });
    });

    toRefs(state);
  }
});
