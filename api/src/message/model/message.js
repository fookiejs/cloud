module.exports = async function (ctx) {
    await ctx.model({
        name: "message",
        database: "mongodb",
        schema: {
            text: {
                type: "string",
                required: true,
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
