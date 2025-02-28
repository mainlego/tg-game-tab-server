// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import AdminView from '../views/admin/AdminView.vue';
import UsersView from '../views/admin/UsersView.vue';
import ProductsView from '../views/admin/ProductsView.vue'; // Импортируем админ страницу продуктов
import UserProductsView from '../views/ProductsView.vue'; // Импортируем пользовательскую страницу продуктов

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView
        },
        {
            path: '/products',
            name: 'products',
            component: UserProductsView // Пользовательская страница продуктов
        },
        {
            path: '/admin',
            name: 'admin',
            component: AdminView
        },
        {
            path: '/admin/users',
            name: 'admin-users',
            component: UsersView
        },
        {
            path: '/admin/products',
            name: 'admin-products',
            component: ProductsView // Админ страница продуктов
        }
        // Другие маршруты
    ]
});

export default router;