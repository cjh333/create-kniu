import MVVM from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import { buildMultipartFormData, optionsToValues, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted } = MVVM;

const abouteditController = controller(() => {
  const state = reactive({
    isSubmitting: false,
    files: [],
    editor: {
      toolbar: [
        'code', '|',
        'undo', 'redo', '|',
        'bold', 'italic', 'underline', 'strikeThrough', '|',
        'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', '|',
        'insertOrderedList', 'insertUnorderedList', '|',
        'h1', 'h2', 'h3', 'p', '|',
        'blockquote', 'pre', 'hr', 'table', '|',
        'fontName', 'fontSize', 'foreColor', 'hiliteColor', '|',
        'link', 'unlink', 'image', 'media', 'emoticons', '|',
        'removeFormat', 'clear', 'selectAll', '|',
        'fullscreen'
      ]
    },
    models: {
      avatar: '',
      summary: '',
      content: ''
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
        state.models.avatar = String(res.data?.avatar || '');
        state.models.summary = String(res.data?.summary || '');
        state.models.content = String(res.data?.content || '');
        state.files = toSingleFileList(res.data?.avatar);
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
      data: buildMultipartFormData(optionsToValues(state.models), { fileField: 'avatar', files: state.files }),
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

  function onAvatarInput(files) {
    state.files = Array.isArray(files) ? files.slice() : [];
  }

  onMounted(getAboutDetail);
  return { state, onSubmit, onAvatarInput };
});

export default abouteditController;
