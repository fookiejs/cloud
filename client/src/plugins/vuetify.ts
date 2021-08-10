import Vue from 'vue';
import Vuetify from 'vuetify/lib/framework';
// @ts-ignore
import tr from 'vuetify/src/locale/tr';

Vue.use(Vuetify);

export default new Vuetify({
    theme:{},
    lang: {
        locales: { tr },
        current: 'tr',
    },
});
