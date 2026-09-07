import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';

const { controller, reactive, onMounted } = KniuMvvm;

const abouteditController = controller(({ autoSync }) => {
  const state = reactive({
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
  // 多标签/多端同时维护「关于我」时，本页自动跟随最新数据。
  autoSync(getAboutDetail);
  return { state, onSubmit };
});

export default abouteditController;
