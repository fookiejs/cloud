export default {
    created: function () {

    },
    methods: {
        content(model, item, key) {
            if (key == "_id") return item[key];
            if (typeof model.schema[key].relation === "string") {
                let maybe = this.$store.state[
                    model.schema[key].relation
                ].pool.find((i) => i._id == item[key]);
                if (!maybe) return "empty";
                return maybe[
                    this.$store.state[model.schema[key].relation].display
                ];
            }
            return item[key] || "empty";
        },
    }
}