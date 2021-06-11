module.exports = {
    name: "page",
    display: "title",
    schema: {
        title: {
            required: true,
            type: "string",
            input: "text"
        },
        content: {
            required: true,
            type: "string",
            input: "rich"
        },
        published: {
            type: "boolean",
            input: "boolean"
        }
    },
    fookie: {
        get: {
            role: ["everybody"]
        },
        post: {
            role: ["system_admin"]
        },
        patch: {
            role: ["system_admin"]
        },
        delete: {
            role: ["system_admin"]
        },
        count: {
            role: ["everybody"]
        },
    },
    mixin: [],
}