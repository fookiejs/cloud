module.exports = async function (ctx) {
    await ctx.model({
        name: "event",
        database: "store",
        display: "user",
        schema: {
            title: {
                input: "timestamp",
                type: "string",
                required: true,
            },
            start: {
                type: "string", input: "text",
                input: "timestamp",
            },
            end: {
                input: "timestamp",
                type: "string"
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
        mixin: [],
    })
}
