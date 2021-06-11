<template>
    <div id="app">
        <div class="flex justify-center">
            <div class="min-h-screen flex overflow-x-scroll py-12">
                <div
                    v-for="column in columns"
                    :key="column.title"
                    class="bg-gray-100 rounded-lg px-3 py-3 column-width rounded mr-4"
                >
                    <p
                        class="text-gray-700 font-semibold font-sans tracking-wide text-sm"
                    >
                        {{ column.title }}
                    </p>
                    <!-- Draggable component comes from vuedraggable. It provides drag & drop functionality -->
                    <draggable
                        :list="column.tasks"
                        :animation="125"
                        ghost-class="ghost-card"
                        group="tasks"
                    >
                        <!-- Each element from here will be draggable and animated. Note :key is very important here to be unique both for draggable and animations to be smooth & consistent. -->
                        <div
                            v-for="task in column.tasks"
                            :key="task"
                            class="mt-3 cursor-move"
                        >
                            <v-card elevation="2">
                                <v-card-title>
                                    {{
                                        task[
                                            $store.state[Model].options.fookie
                                                .display
                                        ]
                                    }}
                                </v-card-title>
                                <v-card-text> ID:{{ task._id }} </v-card-text>
                                <v-card-actions class="m-2">
                                    <fookie-edit :Model="Model" :id="task._id" />
                                    <fookie-delete :Model="Model" :id="task._id" />
                                </v-card-actions>
                            </v-card>
                        </div>
                    </draggable>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import draggable from "vuedraggable";
export default {
    props: ["columns", "Model"],
    components: {
        draggable,
    },
    data() {
        return {};
    },
};
</script>

<style scoped>
.column-width {
    min-width: 320px;
    width: 320px;
}
.ghost-card {
    opacity: 0.5;
    background: #f7fafc;
    border: 1px solid #4299e1;
}
</style>


