module.exports = async function (ctx) {
    await ctx.model({
        name: "user",
        database: "store",
        display: "email",
        schema: {
            firstname: {
                type: "string",
                input:"text"
            },
            lastname: {
                type: "string",
                input:"text"
            },
            email: {
                type: "string",
                required: true,
                input:"text"
            },
            password: {
                type: "string",
                required: true,
                input:"password"
            },
        },
        lifecycle: {
            get: {
                preRUle: [],
                modify: [],
                rule: [],
                role: [],
                filter: [],
                effect: [],

            },
            getAll: {
                preRUle: [],
                modify: [],
                rule: [],
                role: [],
                filter: [],
                effect: [],
            },
            update: {
                preRUle: [],
                modify: [],
                rule: [],
                role: [],
                filter: [],
                effect: [],
            },
            create: {
                preRUle: [],
                modify: [],
                rule: [],
                role: [],
                filter: [],
                effect: [],
            },
            delete: {
                preRUle: [],
                modify: [],
                rule: [],
                role: [],
                filter: [],
                effect: [],
            },
            count: {
                preRUle: [],
                modify: [],
                rule: [],
                role: [],
                filter: [],
                effect: [],
            },
        },
        mixin: [],
    })
}
