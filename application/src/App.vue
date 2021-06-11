<template>
    <div>
        <router-view></router-view>
    </div>
</template>

<script>
export default {
    name: "App",
    data() {
        return {};
    },
    mounted: async function () {
        if (this.$route.name == "home") {
            this.$router.push({ name: "login" });
        }
        await this.$store.dispatch("api", {
            method: "getAll",
            model: "system_model",
        });
        for (let model of this.$store.state.system_model.pool) {
            if (model.name != "system_model") {
                this.$set(this.$store.state, model.name, {
                    _id: model._id,
                    name: model.name,
                    display: model.display,
                    schema: {},
                    fookie: {},
                    pool: [],
                });

                await this.$store.dispatch("api", {
                    method: "schema",
                    model: model.name,
                });
            }
        }
        this.$store.state.system_loaded = true;
    },
};
</script>

<style >
.justify-center {
    justify-content: center;
}
.justify-between {
    justify-content: space-between;
}
.justify-around {
    justify-content: space-around;
}
.flex-wrap {
    flex-wrap: wrap;
}
.myapp {
    background-color: transparent !important;
}

::-webkit-scrollbar {
    display: none;
    width: 10px;
}

::-webkit-scrollbar-track {
    -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
    border-radius: 10px;
}
body {
    overflow: hidden;
}
::-webkit-scrollbar-thumb {
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.5);
}
</style>
