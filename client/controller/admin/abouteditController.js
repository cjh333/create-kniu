import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller, reactive, onMounted } = KniuMvvm;

const abouteditController = controller(() => {
  const state = reactive({
    canEditContent: Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1,
    isSubmitting: false,
    toolbar: 'code | undo redo | bold italic underline strikeThrough | justifyLeft justifyCenter justifyRight justifyFull | insertOrderedList insertUnorderedList | h1 h2 h3 p | blockquote pre hr table | fontname fontsize forecolor hilitecolor | link unlink image media emoticons | removeFormat clearhtml selectAll | maximize',
    aboutModel: {
      content: {
        value: ''
      }
    }
  });

  async function getAboutDetail() {
    await REQUEST({
      url: '/about_detail',
      type: 'POST',
      data: {},
      success(res) {
        if (res.status !== 1) {
          this.$msg({ content: res.msg, type: 'error' });
          return;
        }
        state.aboutModel = { ...state.aboutModel, content: { value: String(res.data?.content || '') } };
      },
      fail(res) {
        this.$msg({ content: res.msg, type: 'error' });
      }
    });
  }

  async function onSubmit() {
    if (!state.canEditContent) return;
    if (state.isSubmitting) return;
    state.isSubmitting = true;
    await REQUEST({
      url: '/about_save',
      type: 'POST',
      data: { content: state.aboutModel.content.value },
      success(res) {
        this.$msg({ content: res.msg, type: res.status === 1 ? 'success' : 'error' });
      },
      fail(res) {
        this.$msg({ content: res.msg, type: 'error' });
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
