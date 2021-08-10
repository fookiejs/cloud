export default [
  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "company",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      name: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      password: {
        required: true,
        type: "string",
        input: "password",
        read: [],
        write: [],
      },
      email: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      address: {
        type: "string",
        input: "rich",
        read: [],
        write: [],
      },
      taxNo: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      taxAd: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school", "hostess"],
    name: "school",
    icon: "mdi-school",
    display: "name",
    edit: ["admin", "company", "school", "teacher"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company", "teacher", "school"],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      email: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      password: {
        type: "string",
        input: "password",
        read: [],
        write: [],
      },
      address: {
        required: true,
        type: "string",
        input: "address",
        address: "position",
        description:
          "Sağ üst köşedeki hedef işaretinden pozisyon belirleyiniz.",
        read: [],
        write: [],
      },
      position: {
        required: true,
        type: "object",
        input: "map",
        description: "Belirlenen adres için ince ayar yapmanızı sağlar.",
        read: [],
        write: [],
      },
      companyId: {
        type: "_id",
        relation: "company",
        read: [],
        write: [],
      },
      creditCardPromotion: {
        required: true,
        type: "string",
        default: 0,
        input: "percent",
        min: 0,
        max: 20,
        description: "Kredi kartına peşin ödemede indirimi.",
        read: [],
        write: ["school"],
      },
      cashPromotion: {
        required: true,
        type: "string",
        default: 0,
        input: "percent",
        min: 0,
        max: 20,
        description: "Nakit ödeme indirimi.",
        read: [],
        write: ["school"],
      },
      sibling1: {
        required: true,
        default: 0,
        type: "string",
        input: "percent",
        min: 0,
        max: 20,
        description: "İlk kardeş için indirim miktarı",
        read: [],
        write: ["school"],
      },
      sibling2: {
        required: true,
        default: 0,
        type: "string",
        input: "percent",
        min: 0,
        max: 20,
        description: "İkinci kardeş için indirim miktarı",
        read: [],
        write: ["school"],
      },
      sibling3: {
        required: true,
        default: 0,
        type: "string",
        input: "percent",
        min: 0,
        max: 20,
        description: "Üçüncü kardeş için indirim miktarı",
        read: [],
        write: ["school"],
      },
      sibling4: {
        required: true,
        type: "string",
        input: "percent",
        default: 0,
        min: 0,
        max: 20,
        description: "Dörtünce kardeş için indirim miktarı",
        read: [],
        write: ["school"],
      },
    },
  },
  {
    menuAuth: ["admin", "company", "school"],
    name: "price_list",
    icon: "mdi-format-list-bulleted-square",
    display: "_id",
    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: [],
    schema: {
      range: {
        description: "Birim: KM",
        required: true,
        type: "array",
        input: "range-slider",
        read: [],
        write: [],
      },
      price: {
        required: true,
        type: "number",
        input: "number",
        read: [],
        write: [],
      },
      schoolId: {
        type: "_id",
        relation: "school",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school", "hostess"],
    name: "student",
    display: "name",
    icon: "mdi-human-female-girl",

    edit: ["admin", "company", "parent", "teacher", "school"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: [
      "admin",
      "company",
      "parent",
      "student",
      "school",
      "teacher",
      "driver",
      "hostess",
    ],
    schema: {
      name: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      identity: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      className: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      birthDay: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      gender: {
        type: "string",
        input: "gender",
        read: [],
        write: [],
      },
      bloodType: {
        type: "string",
        input: "blood",
        read: [],
        write: [],
      },
      schoolId: {
        required: true,
        type: "_id",
        relation: "school",
        read: [],
        write: [],
      },
      scholarship: {
        type: "number",
        input: "percent",
        default: 0,
        min: 0,
        max: 100,
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school", "hostess"],
    name: "address",
    display: "title",
    icon: "mdi-map-marker",
    edit: ["admin", "company"],
    post: ["admin", "company", "parent"],
    delete: ["admin", "company"],
    panel: ["admin", "company", "parent", "school"],
    schema: {
      title: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      description: {
        required: true,
        type: "string",
        input: "address",
        address: "position",
        read: [],
        write: [],
      },
      position: {
        required: true,
        type: "object",
        input: "map",
        read: [],
        write: [],
      },
      studentId: {
        required: true,
        type: "_id",
        relation: "student",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin", "company", "teacher", "school", "hostess"],
    name: "parent",
    icon: "mdi-account-child",
    display: "name",

    edit: ["admin", "company", "parent"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company"],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      email: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      password: {
        required: true,
        type: "string",
        input: "password",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school", "hostess"],
    name: "student_parent",
    display: "_id",
    icon: "mdi-relation-many-to-many",
    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company", "parent"],
    schema: {
      studentId: {
        type: "string",
        relation: "student",
        required: true,
        read: [],
        write: [],
      },
      parentId: {
        type: "string",
        relation: "parent",
        required: true,
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "hostess"],
    name: "teacher",
    display: "name",
    icon: "mdi-human-greeting",
    edit: ["admin", "company", "teacher", "school"],
    post: ["admin", "company", "school"],
    delete: ["admin", "company", "school"],
    panel: ["admin", "company", "school"],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      email: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      password: {
        required: true,
        type: "string",
        input: "password",
        read: [],
        write: [],
      },
      schoolId: {
        type: "_id",
        relation: "school",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin", "company", "teacher", "school", "hostess", "parent"],
    name: "driver",
    display: "name",
    icon: "mdi-horse-human",

    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company", "school", "hostess", "parent"],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      identity: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      email: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      password: {
        required: true,
        type: "string",
        input: "password",
        read: [],
        write: [],
      },
      licence: {
        type: "string",
        input: "file",
        maxSize: 5 * 1024 * 1024,
        read: [],
        write: [],
      },
      crime: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      crimeEnd: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      psychotechnic: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      psychotechnicEnd: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      healthReport: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      healthReportEnd: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      src: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      srcEnd: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      companyId: {
        type: "_id",
        relation: "company",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school"],
    name: "hostess",
    display: "name",
    icon: "mdi-face-woman-outline",
    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company", "parent", "school"],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      identity: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "phone",
        read: [],
        write: [],
      },
      email: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      password: {
        required: true,
        type: "string",
        input: "password",
        read: [],
        write: [],
      },
      companyId: {
        type: "_id",
        relation: "company",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school", "hostess"],
    name: "vehicle",
    icon: "mdi-bus-side",
    display: "plate",
    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin"],
    schema: {
      plate: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      vehicleInspection: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      vehicleInsurance: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      seatInsurance: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      indenture: {
        type: "string",
        input: "file",
        read: [],
        write: [],
      },
      companyId: {
        type: "_id",
        relation: "company",
        read: [],
        write: [],
      },
      position: {
        required: true,
        type: "object",
        input: "map",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: [
      "parent",
      "admin",
      "company",
      "driver",
      "teacher",
      "school",
      "hostess",
    ],
    name: "transport",
    icon: "mdi-bus-stop-covered",
    display: "title",

    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company", "school", "parent", "hostess"],
    schema: {
      title: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      driverId: {
        type: "_id",
        relation: "driver",
        read: [],
        write: [],
      },
      vehicleId: {
        type: "_id",
        relation: "vehicle",
        read: [],
        write: [],
      },
      hostessId: {
        type: "_id",
        relation: "hostess",
        read: [],
        write: [],
      },
      schoolId: {
        type: "_id",
        relation: "school",
        read: [],
        write: [],
      },
      color: {
        type: "string",
        input: "color",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company", "teacher", "school", "hostess"],
    name: "transport_cycle",
    icon: "mdi-refresh",
    display: "_id",
    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin", "company"],
    schema: {
      transportId: {
        input: "_id",
        relation: "transport",
        read: [],
        write: [],
      },
      start: {
        type: "string",
        input: "time",
        read: [],
        write: [],
      },
      end: {
        type: "string",
        input: "time",
        read: [],
        write: [],
      },
      day: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: [
      "parent",
      "admin",
      "company",
      "driver",
      "teacher",
      "school",
      "hostess",
    ],
    name: "transport_student",
    icon: "mdi-bus-clock",
    display: "_id",
    edit: ["admin", "company"],
    post: ["admin", "company"],
    delete: ["admin", "company"],
    panel: ["admin"],
    schema: {
      transportId: {
        type: "_id",
        relation: "transport",
        read: [],
        write: [],
      },
      studentId: {
        type: "_id",
        relation: "student",
        read: [],
        write: [],
      },
      addressId: {
        type: "_id",
        required: true,
        relation: "address",
        filterBy: "studentId",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["parent", "admin", "company"],
    name: "transaction",
    display: "_id",
    icon: "mdi-cash",
    edit: ["admin"],
    post: ["admin", "company"],
    delete: ["admin"],
    panel: [],
    schema: {
      studentId: {
        type: "_id",
        relation: "student",
        read: [],
        write: [],
      },
      date: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      amount: {
        type: "number",
        input: "number",
        min: 0,
        read: [],
        write: [],
      },
      type: {
        type: "string",
        input: "select",
        options: ["first", "monthly", "debt"],
        read: [],
        write: [],
      },
      description: {
        type: "string",
        input: "rich",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: [
      "parent",
      "admin",
      "company",
      "driver",
      "teacher",
      "school",
      "hostess",
    ],
    name: "excuse",
    display: "_id",
    icon: "mdi-bus-alert",
    edit: ["admin", "company", "parent", "school", "teacher"],
    post: ["admin", "company", "parent", "teacher", "school"],
    delete: ["admin", "company", "parent"],
    panel: ["admin", "company"],
    schema: {
      transport_cycle: {
        type: "_id",
        relation: "transport",
        read: [],
        write: [],
      },
      date: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      studentId: {
        type: "_id",
        relation: "student",
        read: [],
        write: [],
      },
      description: {
        type: "string",
        input: "rich",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: [
      "parent",
      "admin",
      "company",
      "driver",
      "teacher",
      "school",
      "hostess",
    ],
    name: "student_transport_cycle_status",
    display: "_id",
    icon: "mdi-list-status",
    edit: ["driver", "hostess"],
    post: [],
    delete: [],
    panel: ["admin", "company"],
    schema: {
      transport_cycle: {
        type: "_id",
        relation: "transport",
        read: [],
        write: [],
      },
      studentId: {
        type: "string",
        input: "date",
        read: [],
        write: [],
      },
      called: {
        type: "string",
        input: "time",
        read: [],
        write: [],
      },
      in: {
        type: "string",
        input: "time",
        read: [],
        write: [],
      },
      out: {
        type: "string",
        input: "time",
        read: [],
        write: [],
      },
      status: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin", "company"],
    name: "contract",
    icon: "mdi-file-account",
    display: "_id",
    edit: ["admin"],
    post: [],
    delete: ["admin"],
    panel: ["admin"],
    schema: {
      studentId: {
        required: true,
        type: "_id",
        relation: "student",
        read: [],
        write: [],
      },
      contract: {
        required: true,
        type: "file",
        input: "file",
        read: [],
        write: [],
      },
      receipt: {
        required: true,
        type: "file",
        input: "file",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin"],
    name: "system_menu_type",
    display: "key",
    icon: "mdi-menu-open",
    edit: [],
    post: [],
    delete: [],
    panel: [],
    schema: {
      key: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
    pool: [
      { _id: "1", key: "child" },
      { _id: "2", key: "childless" },
    ],
  },
  {
    menuAuth: ["admin"],
    name: "system_menu",
    display: "name",
    icon: "mdi-menu",
    edit: [],
    post: [],
    delete: [],
    panel: [],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      icon: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      type: {
        type: "_id",
        relation: "system_menu_type",
        read: [],
        write: [],
      },
      to: {
        type: "object",
        input: "json",
        read: [],
        write: [],
      },
    },
    pool: [
      {
        _id: "1",
        name: "livemap",
        icon: "mdi-map-legend",
        type: "2",
        to: { name: "live" },
      },
    ],
  },
  {
    menuAuth: ["admin"],
    name: "system_submenu",
    display: "name",
    icon: "mdi-menu-open",
    edit: [],
    post: [],
    delete: [],
    panel: [],
    schema: {
      name: {
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      system_menu: {
        type: "_id",
        relation: "system_menu",
        read: [],
        write: [],
      },
    },
    pool: [],
  },
  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "worker",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      name: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      phone: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      email: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "activity",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      type: {
        required: true,
        relation: "activity_type",
        input: "relation",
        read: [],
        write: [],
      },
      date: {
        required: true,
        type: "date",
        input: "date",
        read: [],
        write: [],
      },
      time: {
        required: true,
        type: "time",
        input: "time",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "activity_type",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      name: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "opportunity",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      activity: {
        required: true,
        relation: "activity",
        input: "relation",
        read: [],
        write: [],
      },
      description: {
        required: true,
        type: "rich",
        input: "text",
        read: [],
        write: [],
      },
      product: {
        required: true,
        relation: "product",
        input: "relation",
        read: [],
        write: [],
      },
      amount: {
        required: true,
        type: "rich",
        input: "text",
        read: [],
        write: [],
      },
      price: {
        required: true,
        type: "rich",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "offer",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      date: {
        required: true,
        type: "date",
        input: "date",
        read: [],
        write: [],
      },
      opportunity: {
        required: true,
        relation: "opportunity",
        input: "relation",
        read: [],
        write: [],
      },
    },
  },

  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "product",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      name: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
      description: {
        required: true,
        type: "rich",
        input: "text",
        read: [],
        write: [],
      },
    },
  },

  {
    menuAuth: ["admin"],
    icon: "mdi-domain",
    name: "customer",
    display: "name",
    edit: ["admin", "company"],
    post: ["admin"],
    delete: ["admin"],
    panel: ["admin", "company"],
    schema: {
      name: {
        required: true,
        type: "string",
        input: "text",
        read: [],
        write: [],
      },
    },
  },
];
