import MVVM from '../../core/kniumvvm.mjs';
import { buildMultipartFormData, optionsToValues, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller } = MVVM;

const abouteditController = controller(({ $msg, request, reactive, onMounted }) => {
  const state = reactive({
    isSubmitting: false,
    files: [],
    models: {
      avatar: '',
      summary: '',
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
        state.models.avatar = String(res.data?.avatar || '');
        state.models.summary = String(res.data?.summary || '');
        state.models.content = String(res.data?.content || '');
        state.files = toSingleFileList(res.data?.avatar);
      },
      fail(res) {
        $msg({ content: res.msg, type: 'error' });
      }
    });
  }

  async function onSubmit() {
    if (state.isSubmitting) return;
    state.isSubmitting = true;
    await request({
      url: '/about_save',
      type: 'POST',
      data: buildMultipartFormData(optionsToValues(state.models), { fileField: 'avatar', files: state.files }),
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

  onMounted(getAboutDetail);
  return { state, onSubmit };
});

export default abouteditController;
