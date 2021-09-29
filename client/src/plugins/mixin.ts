import lodash from "lodash";
export default {
  computed: {
    crumbs: function () {
      let pathArray = (this as any).$route.path.split("/");
      pathArray.shift();
      return pathArray.reduce(
        (breadcrumbArray: any, path: any, idx: number) => {
          let vue = this as any;
          breadcrumbArray.push({
            exact: true,
            to: idx > 0 ? breadcrumbArray[idx - 1].to + "/" + path : "/" + path,
            text: vue.$t(path),
          });
          return breadcrumbArray;
        },
        [],
      );
    },
  },
  methods: {
    related_fields(modelName: string) {
      let res: any = {};
      (this as any).$store.state.model.pool.forEach((model: any) => {
        let schemaKeys = Object.keys((this as any).$store.state[model].schema);
        for (let field of schemaKeys) {
          if (
            JSON.stringify((this as any).$store.state[model].schema[field])
              .includes(`"relation":"${modelName}"`)
          ) {
            if (!res[model]) {
              res[model] = [];
            }
            res[model].push(field);
          }
        }
      });
      return res;
    },
    getModel(name: string): Object {
      return lodash.find((this as any).$store.state.model, { name });
    },
    pool(name:string):any{
      return (this as any ).$store.state[name];
    }
  },
};
