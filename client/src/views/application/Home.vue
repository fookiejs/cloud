<template lang='pug'>
  v-container(fluid)
    v-row
      v-col
        v-card
          v-card-title Hoşgeldiniz
          v-card-text Servisizle Servisiniz ile ilgili tüm süreçlerinizi yönetmeyi amaçlar.
      v-col
        v-card
          v-card-title Haberler
          v-card-text Servisizle Betada
      v-col
        v-card
          v-card-title Haberler
          v-card-text Servisizle Betada
    v-row
      v-col
        fookie-viewer(:model="$store.state.transport_cycle")
      v-col
        fookie-viewer(:model="$store.state.transport_cycle")
    v-row
      v-col
      v-col
        fookie-viewer(:model="$store.state.excuse")
</template>
