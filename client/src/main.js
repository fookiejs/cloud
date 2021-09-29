import Vue from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';
import vuetify from './plugins/vuetify';
//import { Auth } from 'aws-amplify';
//import '@aws-amplify/ui-vue';
import I18n from './language/amplify';
import viewer from './components/fookie/view.vue';
import post from './components/fookie/post.vue';
import postFlat from './components/fookie/fookie-post-flat.vue';
import remove from './components/fookie/delete.vue';
import relationtab from './components/fookie/relation_tab.vue';
import fookieCard from './components/fookie/card.vue';
import fookieField from './components/fookie/field.vue';
import panel from './components/fookie/panel.vue';

import VueI18n from 'vue-i18n';
import VJsoneditor from 'v-jsoneditor';
import { LControl, LIcon, LMap, LMarker, LPolyline, LPopup, LTileLayer } from 'vue2-leaflet';
import { Icon } from 'leaflet';
import messages from './language/messages';
import { VueMaskDirective, VueMaskFilter } from 'v-mask';
import mixin from './plugins/mixin';
import VueExcelEditor from 'vue-excel-editor';

Vue.use(VJsoneditor);

Vue.component('l-map', LMap);
Vue.component('l-tile-layer', LTileLayer);
Vue.component('l-marker', LMarker);
Vue.component('l-icon', LIcon);
Vue.component('l-popup', LPopup);
Vue.component('l-polyline', LPolyline);
Vue.component('l-control', LControl);
Vue.component('fookie-viewer', viewer);
Vue.component('fookie-delete', remove);
Vue.component('fookie-post', post);
Vue.component('fookie-post-flat', postFlat);
Vue.component('fookie-panel', panel);
Vue.component('fookie-relation-tab', relationtab);
Vue.component('fookie-card', fookieCard);
Vue.component('fookie-field', fookieField);



Vue.use(VueExcelEditor);


Vue.directive('mask', VueMaskDirective);
Vue.filter('VMask', VueMaskFilter);

// @ts-ignore
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});
import 'leaflet/dist/leaflet.css';
Vue.use(VueI18n);

const i18n = new VueI18n({
    locale: 'tr',
    messages,
    silentTranslationWarn: true,
});

I18n.setLanguage('tr');
Vue.config.productionTip = false;
Vue.mixin(mixin);

new Vue({
    i18n,
    router,
    store,
    vuetify,
    render: (h) => h(App),
}).$mount('#app');
