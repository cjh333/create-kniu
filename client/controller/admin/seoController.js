import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { isAdminRole, makeFail, requireLogin, withSubmitting } from './adminShared.js';
import { buildMultipartFormData, fillOptionsFromResponse, optionsToValues, required, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const seoController = controller(({ $msg, navigateTo, request, reactive, onMounted }) => {
  const actions = createRequestActions({ request, msg: $msg });
  const state = reactive({
    canEditContent: isAdminRole(AUTH.getUser()),
    isSubmitting: false,
    files: [],
    seoModel: {
      id: '',
      title: required('请输入网站名称'),
      url: required('请输入网站域名'),
      logo: required('请选择网站logo'),
      description: required('请输入description描述'),
      keywords: required('请输入keywords关键词'),
      author: required('请输入author作者'),
      copyright: required('请输入版权'),
      icp: required('请输入备案号'),
      email: required('请输入邮箱'),
    }
  });

  let seoRequest = null;

  async function getSeoList() {
    if (seoRequest) return seoRequest;
    const run = request({
      url: '/seo_list',
      type: 'POST',
      mutation: false,
      success(res) {
        if (res.status !== 1) {
          $msg({ content: res.msg, type: 'error' });
          return;
        }
        const item = fillOptionsFromResponse(state.seoModel, res.data);
        if (!item) return;
        state.files = toSingleFileList(state.seoModel.logo.value);
      },
      fail: makeFail($msg)
    }).finally(function () {
      seoRequest = null;
    });
    seoRequest = run;
    return run;
  }

  async function onSubmit() {
    if (!state.canEditContent) return;
    await withSubmitting(state, async () => {
      const data = buildMultipartFormData(optionsToValues(state.seoModel), {
        fileField: 'logo',
        files: state.files
      });
      await actions.post('/seo_update', data);
    });
  }

  onMounted(function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    getSeoList();
  });

  return { state, onSubmit };
});

export default seoController;