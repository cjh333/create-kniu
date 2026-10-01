import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { buildMultipartFormData, fillOptionsFromResponse, optionsToValues, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const seoController = controller(({ $msg, request, reactive, onMounted }) => {
  const state = reactive({
    canEditContent: Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1,
    isSubmitting: false,
    files: [],
    seoModel: {
      id: '',
      title: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入网站名称'
      },
      url: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入网站域名'
      },
      logo: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请选择网站logo'
      },
      description: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入description描述'
      },
      keywords: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入keywords关键词'
      },
      author: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入author作者'
      },
      copyright: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入版权'
      },
      icp: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入备案号'
      },
      email: {
        value: '',
        condition: /^(?=.*\S).+$/,
        message: '请输入邮箱'
      },
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
      fail(res) { $msg({ content: res.msg, type: 'error' }); }
    }).finally(function () {
      seoRequest = null;
    });
    seoRequest = run;
    return run;
  }

  async function onSubmit() {
    if (!state.canEditContent) return;
    if (state.isSubmitting) {
      return;
    }
    state.isSubmitting = true;
    const data = buildMultipartFormData(optionsToValues(state.seoModel), {
      fileField: 'logo',
      files: state.files
    });
    await request({
      url: '/seo_update',
      type: 'POST',
      data: data,
      success(res) {
        $msg({ content: res.msg, type: res.status === 1 ? 'success' : 'error' });
      },
      fail(res) {
        $msg({ content: res.msg, type: 'error' });
      },
      complete() {
        state.isSubmitting = false;
      }
    });
  }

  onMounted(getSeoList);

  return { state, onSubmit };
});

export default seoController;
