module.exports = async function (ctx) {
    await ctx.model({
        name: "message",
        database: "mongodb",

        schema: {
            group: {
                relation: "group",
                required: true,
                input: "relation"
            },
            user: {
                relation: "user",
                required: true,
                input: "relation"
            },
            text: {
                type: "string",
                required: true,
                input: "text"
            }
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
        mixin: ["cache"],
    })
}