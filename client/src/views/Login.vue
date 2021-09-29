<template lang='pug'>
  div.h-screen.flex.justify-center.items-center
    div
      v-tabs(v-model="tab" color='green')
        v-tab Giriş
        v-tab(:disabled='!needReset') Şifre Değiştir
        v-tab Bize Ulaşın
      v-tabs-items(v-model="tab")
        v-tab-item
          v-card
            v-card-text
              form
                v-text-field(name="username" v-model='phone' :label="$t('phone')" v-mask="'+90 (###) ###-####'" append-icon="mdi-phone")
                v-text-field(name="password" type='password' v-model='password' :label="$t('password')" append-icon="mdi-lock")
            v-card-actions
              v-btn(@click='login') Giriş
        v-tab-item
          v-card
            v-card-text
              form
                v-text-field(name="old_pw" type='password' v-model='oldPw' :label="$t('password')" append-icon="mdi-lock")
                v-text-field(name="new_pw" type='password' v-model='newPw' :label="$t('password')" append-icon="mdi-lock")
            v-card-actions
              v-btn(@click='resetPw') Sıfırla
        v-tab-item
          v-card
            v-card-text iletişim form
</template>


<script>
import { Auth } from 'aws-amplify';
import { onAuthUIStateChange } from '@aws-amplify/ui-components';

export default {
  data() {
    return {
      needReset: false,
      cognitoUser: null,
      tab: 0,
      oldPw: '',
      newPw: '',
      unsubscribeAuth: undefined,
      phone: '',
      password: '',
    };
  },
  mounted() {
    return
    this.unsubscribeAuth = onAuthUIStateChange((authState, authData) => {
      if (authState === 'signedin' && authData) this.$router.push({ name: 'application' });
    });

  },
  methods: {
    login: async function() {
      let vue = this;
      this.$router.push({ name: 'application' });
      return
      this.cognitoUser = await Auth.signIn({
        username: vue.phone.replace(/[\(\)\- ]+/g, ''),
        password: vue.password,
      });
      if (this.cognitoUser.challengeName == 'NEW_PASSWORD_REQUIRED') {
        this.tab = 1;
        this.needReset = true;
      } else {
        this.$router.push({ name: 'application' });
      }

    },
    resetPw: async function() {
      await this.cognitoUser.completeNewPasswordChallenge(this.newPw);
    },
  },
};
</script>

<style>
</style>