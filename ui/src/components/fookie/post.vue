<template lang="pug">
div 
  div(v-for="(field, key) in model.schema", :key="key")
    div(v-if="field.input==='text'") 
      v-text-field(:label='key' v-model="body[key]")
    div(v-if="field.input==='number'") 
      div number
    div(v-if="field.input==='timestamp'") 
      div timestamp
    div(v-if="field.input==='date'") 
      div date
    div(v-if="field.input==='time'") 
      div time
    div(v-if="field.input==='color'") 
      div color
    div(v-if="field.input==='range'") 
      div range
    div(v-if="field.input==='boolean'") 
      div boolean
    div(v-if="field.input==='phone'") 
      div phone
    div(v-if="field.input==='address'") 
      div address
    div(v-if="field.input==='password'") 
      v-text-field(:label="key" v-model="body[key]" type="password")
    div(v-if="field.input==='relation'") 
      div relation
</template>

<script>
export default {
  props: ["model"],
  data(){
    return {
      body:{}
    }
  }
};
</script>

<style>
</style>