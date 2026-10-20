import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { assignOptionFields, buildMultipartFormData, optionsToValues, required, toSingleFileList } from '../../core/kniuutil.mjs';
import { adminEditorMaxHeight, makeFail, requireLogin, withSubmitting } from './adminShared.js';

const { controller } = MVVM;

const abouteditController = controller(({ $msg, navigateTo, request, reactive, onMounted }) => {
  const actions = createRequestActions({ request, msg: $msg });
  const state = reactive({
    isSubmitting: false,
    files: [],
    editorMaxHeight: adminEditorMaxHeight(),
    models: {
      avatar: '',
      summary: required('请输入首页关于我的简述'),
      content: ''
    }
  });

  async function getAboutDetail() {
    await request({
      url: '/about_detail',
      type: 'POST',
      mutation: false,
      data: {},
      success(res) {
        if (res.status !== 1) {
          $msg({ content: res.msg, type: 'error' });
          return;
        }
        assignOptionFields(state.models, res.data);
        state.files = toSingleFileList(state.models.avatar);
      },
      fail: makeFail($msg)
    });
  }

  async function onSubmit() {
    await withSubmitting(state, async () => {
      await actions.post('/about_save', buildMultipartFormData(optionsToValues(state.models), { fileField: 'avatar', files: state.files }));
    });
  }

  onMounted(function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    getAboutDetail();
  });
  return { state, onSubmit };
});

export default abouteditController;