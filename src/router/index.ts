import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import ReminderEditor from '../views/ReminderEditor.vue';
import ReminderDetails from '../views/ReminderDetails.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
  },
  {
    path: '/reminder/new',
    name: 'ReminderNew',
    component: ReminderEditor,
  },
  {
    path: '/reminder/:id/edit',
    name: 'ReminderEdit',
    component: ReminderEditor,
  },
  {
    path: '/reminder/:id',
    name: 'ReminderDetails',
    component: ReminderDetails,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
