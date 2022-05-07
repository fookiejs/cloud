module.exports = async function (ctx) {
    await ctx.model({
        name: "event_member",
        database: "mongodb",
        schema: {
            user: {
                relation: "user",
            },
            coming: {
                type: "boolean",
                default: false,
            }
        },
        lifecycle: {
            read: {
                role: ["system"],
            },
            update: {
                role: ["system"],
            },
            create: {
                role: ["system"],
            },
            delete: {
                role: ["system"],
            },
            count: {
                role: ["system"],
            },
        },
        mixin: ["cache"],
    })
}
