<template>
    <div>
        <div v-if="(typeof fieldValue) != 'object'">{{ fieldValue }}</div>
        <div v-if="select == 'object'">{{ fieldValue[display] }}</div>
        <div v-if="select == 'relation'">
            <div v-if="relationModel == 'Ticket_Status'">
                <v-chip :color="fieldValue.color.hex" label text-color="white">
                    <v-icon left> mdi-label-outline </v-icon>
                    {{ fieldValue[display] }}
                </v-chip>
            </div>
            <div v-else>{{ fieldValue[display] }}</div>
        </div>
    </div>
</template>

<script>
export default {
    props: ["fieldName", "fieldValue", "Model"],
    data() {
        return {
            supporteds: ["Ticket_Status"],
            relationModel: "",
            display: "",
            select: "object",
        };
    },
    mounted() {
        this.relationModel =
            this.$store.state[this.Model].options.fields[this.fieldName]
                .relation.model || null;

        this.display =
            this.$store.state[this.relationModel].options.fookie.display ||
            "name";

        if (this.relationModel) {
            this.select = "relation";
        } else if (typeof this.fieldValue == "object") {
            this.select = "object";
        }
    },
};
</script>

<style>
</style>