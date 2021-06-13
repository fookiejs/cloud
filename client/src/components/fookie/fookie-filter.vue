<template>
    <v-card class="p-2" elevation="0">
        <v-card-title>Client-Filter</v-card-title>
        <v-row>
            <v-col v-for="f in options.fields" :key="f">
                <v-text-field :label="f.fieldName" />
            </v-col>
        </v-row>
    </v-card>
</template>

<script>
export default {
    props: ["options"],
};
</script>

<style>
</style>