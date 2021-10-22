module.exports = async function (ctx) {
    await ctx.model({
        name: "message",
        database: "store",
        display: "name",
        schema: {
            room: {
                relation: "room",
                required: true,
            },
            user: {
                relation: "user",
                required: true,
            },
            text: {
                type: "string",
                required: true,
            },
            rooms: {
                type: "array",
                required: true,
                default: []
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
