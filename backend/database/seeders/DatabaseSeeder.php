<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        User::create([
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => Hash::make('password'),
        ]);
        $categories = collect(['Phones', 'Laptops', 'Accessories', 'Home'])
            ->map(fn($name) => Category::create([
                'name' => $name,
                'slug' => Str::slug($name),
            ]));
        foreach ($categories as $category) {
            for ($i = 1; $i <= 6; $i++) {
                $name = "{$category->name} Item {$i}";
                Product::create([
                    'category_id' => $category->id,
                    'name' => $name,
                    'slug' => Str::slug($name),
                    'description' => "Sample description for {$name}.",
                    'price' => rand(100, 5000),
                    'stock' => rand(5, 30),
                ]);
            }
        }
    }
}
