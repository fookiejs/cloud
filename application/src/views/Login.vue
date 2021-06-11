<template>
    <div class="h-screen flex justify-center items-center">
        <v-card width="500">
            <v-card-title>Login</v-card-title>
            <v-card-text>
                <form>
                    <v-text-field v-model="email" label="E-Mail"></v-text-field>
                    <v-text-field
                        v-model="password"
                        label="Password"
                    ></v-text-field>
                </form>
            </v-card-text>
            <v-card-actions>
                <v-btn @click="login">Login </v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>

<script>
export default {
    data() {
        return {
            email: "",
            password: "",
        };
    },
    mounted() {
        this.login();
    },
    methods: {
        login: async function () {
            let body = { email: "admin", password: "admin" };
            let res = await this.$store.dispatch("api", {
                method: "login",
                model: "system_user",
                body,
            });
            if (typeof res == "string") {
                localStorage.setItem("token", res);
                this.$router.push({ name: "game" });
            }
        },
    },
};
</script>

<style>
</style>