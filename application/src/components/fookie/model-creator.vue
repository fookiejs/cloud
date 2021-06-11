<template>
  <v-container>
        <v-row
            style="margin:20px; border:1px solid darkgray; border-radius:15px; padding:15px;"
            v-for="(model, i) in models"
            :key="model[i]"
        >
            <v-col>
                <v-row>
                    <v-col>
                        <v-text-field
                            label="Model Name"
                            v-model="model.model"
                        ></v-text-field
                    ></v-col>
                    <v-col>
                        <v-select
                            v-model="value"
                            :items="roles"
                            attach
                            chips
                            label="Who can post"
                            multiple
                        ></v-select
                    ></v-col>
                    <v-col
                        ><v-select
                            v-model="value"
                            :items="roles"
                            attach
                            chips
                            label="Who can delete"
                            multiple
                        ></v-select
                    ></v-col>
                </v-row>

                <v-row></v-row>
                <v-row></v-row>

                <v-row class="" v-for="(f, j) in model.fields" :key="f[j]">
                    <v-col>
                        <v-row>
                            <v-text-field
                                label="Field Name"
                                v-model="f.field"
                            ></v-text-field>
                            <v-text-field
                                label="Default"
                                v-model="f.default"
                            ></v-text-field>
                            <v-select :items="rModel" label="İlişki"></v-select>
                            <v-select :items="types" label="Type"></v-select>
                        </v-row>
                        <v-row>
                            <v-col>
                                <v-checkbox
                                    v-model="f.allowNull"
                                    label="Allow Null"
                                ></v-checkbox
                            ></v-col>
                            <v-col>
                                <v-checkbox
                                    v-model="f.require"
                                    label="Require"
                                ></v-checkbox
                            ></v-col>
                            <v-col>
                                <v-checkbox
                                    v-model="f.uniq"
                                    label="Unique"
                                ></v-checkbox
                            ></v-col>
                            <v-col>
                                <v-select
                                    v-model="f.read.auth"
                                    :items="roles"
                                    attach
                                    chips
                                    label="Read"
                                    multiple
                                ></v-select
                            ></v-col>
                            <v-col>
                                <v-select
                                    v-model="f.write.auth"
                                    :items="roles"
                                    attach
                                    chips
                                    label="Write"
                                    multiple
                                ></v-select
                            ></v-col>

                            <v-col>
                                <v-btn
                                    text
                                    color="red accent-4"
                                    @click="deleteField(model, j)"
                                >
                                    Delete Field
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-col>
                </v-row>
                <v-row>
                    <v-btn text @click="addField(model)">Field Ekle</v-btn>
                    <v-btn text color="green accent-4"> Save </v-btn>
                    <v-btn text color="red accent-4" @click="deleteModel(i)">
                        Delete Model
                    </v-btn>
                </v-row>
            </v-col>
        </v-row>

        <v-btn class="w-full" @click="addModel">ADD MODEL</v-btn>
    </v-container>
</template>

<script>
export default {

}
</script>

<style>

</style>