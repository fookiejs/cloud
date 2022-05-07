module.exports = async function (ctx) {
    await ctx.model({
        name: "event",
        database: "mongodb",
        schema: {
            title: {
                type: "string",
                required: true,
            },
            start: {
                type: "number"
            },
            end: {
                type: "number"
            }
        },
        lifecycle: {
            read: {
                role: ["system"],
            },
            update: {
                role: ["system", "role1", "role2"],
                reject: {
                    system: ["everybody"]
                },
                accept: {
                    role2: ["asd"]
                }
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
