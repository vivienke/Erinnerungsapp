<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Battery</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-input
          label="Battery Level"
          readonly
          v-model="batteryLevelAsText"
        ></ion-input>
      </ion-item>
      <ion-button
        @click="refreshBatteryLevel()"
        expand="block"
        :disabled="disableButton"
        >Refresh</ion-button
      >
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonInput,
  IonButton,
} from "@ionic/vue";
import { defineComponent } from "vue";
import { Device } from "@capacitor/device";

export default defineComponent({
  components: {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonItem,
    IonInput,
    IonButton,
  },
  data() {
    return {
      batteryLevel: undefined as number | undefined,
      disableButton: false,
    };
  },
  computed: {
    batteryLevelAsText() {
      if (this.batteryLevel === undefined) {
        return "Unknown";
      } else {
        return this.batteryLevel * 100 + "%";
      }
    },
  },
  methods: {
    async refreshBatteryLevel() {
      this.disableButton = true;
      const { batteryLevel } = await Device.getBatteryInfo();
      this.batteryLevel = batteryLevel;
      this.disableButton = false;
    },
  },
});
</script>
