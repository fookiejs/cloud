<template lang='pug'>
fookie-viewer(
  :model="this.getModel($route.params._model)",
  :panel="true",
  :patch="true",
  :post="true",
  :remove="true",
  :key="$route.params._model"
)
</template>
