import { defineComponent, reactive, onMounted, toRefs } from '../core/kniumvvm.mjs';
import { REQUEST } from '../core/kniurequest.mjs';

export const seoController = defineComponent({
  setup({ eventTo, root }) {
    const state = reactive({
      title: '',
      url: '',
      logo: '',
      description: '',
      keywords: '',
      author: '',
      copyright: '',
      record: '',
      email: '',
      id: '',
      isSubmitting: false
    });

    async function getSeoList() {
      const result = await REQUEST({ url: '/seo_list', type: 'POST' });
      if (result.status === 1) {
        kniu.each(result.data, function (res) {
          state.id = res.id;
          state.title = res.title;
          state.logo = res.logo;
          state.url = res.url;
          state.description = res.description;
          state.keywords = res.keywords;
          state.author = res.author;
          state.copyright = res.copyright;
          state.record = res.record;
          state.email = res.email;
        });
        return;
      }
      eventTo?.emit('toast', result.msg);
    }

    async function onSubmit() {
      if (state.isSubmitting) {
        return;
      }
      state.isSubmitting = true;
      const result = await REQUEST({
        url: '/seo_update',
        type: 'POST',
        data: {
          id: state.id,
          title: state.title,
          url: state.url,
          logo: state.logo,
          description: state.description,
          keywords: state.keywords,
          author: state.author,
          copyright: state.copyright,
          record: state.record,
          email: state.email
        }
      });
      if (result.status === 1) {
        state.isSubmitting = false;
        eventTo?.emit('toast', result.msg);
        return;
      }
      state.isSubmitting = false;
      eventTo?.emit('toast', result.msg);
    }

    onMounted(() => {
      kniu.form({ el: root.querySelector('#seoform') });
      getSeoList();
    });

    toRefs({ state, onSubmit });
  }
});
