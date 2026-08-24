import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import { buildMultipartFormData, fillModelFromResponse, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted } = KniuMvvm;

const seoController = controller(() => {
    const state = reactive({
      isSubmitting: false,
      files: [],
      seoform: {
        title: '',
        url: '',
        logo: '',
        description: '',
        keywords: '',
        author: '',
        copyright: '',
        record: '',
        email: '',
        id: ''
      },
      rules: {
        title: {
          condition: /^(?=.*\S).+$/,
          message: '请输入网站名称'
        },
        url: {
          condition: /^(?=.*\S).+$/,
          message: '请输入网站域名'
        },
        logo: {
          condition: /^(?=.*\S).+$/,
          message: '请选择网站logo'
        },
        description: {
          condition: /^(?=.*\S).+$/,
          message: '请输入description描述'
        },
        keywords: {
          condition: /^(?=.*\S).+$/,
          message: '请输入keywords关键词'
        },
        author: {
          condition: /^(?=.*\S).+$/,
          message: '请输入author作者'
        },
        copyright: {
          condition: /^(?=.*\S).+$/,
          message: '请输入版权'
        },
        record: {
          condition: /^(?=.*\S).+$/,
          message: '请输入备案号'
        },
        email: {
          condition: /^(?=.*\S).+$/,
          message: '请输入邮箱'
        }
      }
    });

    async function getSeoList() {
      await REQUEST({
        url: '/seo_list',
        type: 'POST',
        success(res) {
          if (res.status !== 1) {
            this.$msg({ content: res.msg, type: 'error' });
            return;
          }
          const item = fillModelFromResponse(state.seoform, res.data);
          if (!item) return;
          state.files = toSingleFileList(state.seoform.logo);
        },
        fail(res) { this.$msg({ content: res.msg, type: 'error' }); }
      });
    }

    async function onSubmit() {
      if (state.isSubmitting) {
        return;
      }
      state.isSubmitting = true;
      const data = buildMultipartFormData(state.seoform, {
        fileField: 'logo',
        files: state.files
      });
      await REQUEST({
        url: '/seo_update',
        type: 'POST',
        data: data,
        async success(res) {
          this.$msg({ content: res.msg, type: res.status === 1 ? 'success' : 'error' });
          if (res.status === 1) await getSeoList();
        },
        fail(res) {
          this.$msg({ content: res.msg, type: 'error' });
        },
        complete() {
          state.isSubmitting = false;
        }
      });
    }

    onMounted(() => {
      getSeoList();
    });

    return { state, onSubmit };
});

export default seoController;
