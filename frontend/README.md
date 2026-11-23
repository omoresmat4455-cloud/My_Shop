# E-Commerce Frontend

A modern, responsive e-commerce application built with React, Vite, and Tailwind CSS.

## Features

### User Features
- **Product Browsing**
  - View products with images, prices, and categories
  - Search products by name
  - Filter by category
  - Filter by price range (min/max)
  - Sort by newest, price low-to-high, or price high-to-low
  - Pagination for large product lists

- **Shopping Cart**
  - Add products to cart
  - Adjust quantities with +/- buttons (instant UI updates)
  - Remove items from cart
  - Real-time total calculation
  - Stock validation

- **Checkout**
  - Enter shipping details (address, city, phone)
  - Select payment method (Cash on Delivery or Online)
  - Order creation and confirmation

- **Payment Methods**
  - Credit/Debit Card payment
  - Mobile Wallet payments:
    - Vodafone Cash
    - Orange Money
    - Etisalat Cash
  - Cash on Delivery
  - Payment method selection modal
  - Payment form with card/wallet details
  - Payment success/failure confirmation

- **Order Management**
  - View order history
  - Track order status (Pending, Processing, Shipped, Delivered, Cancelled)
  - View payment status
  - Pay for unpaid orders from My Orders page
  - Product images in order items

### Admin Features
- **Dashboard**
  - Store statistics (total orders, revenue, products, users)
  - Recent orders overview
  - Revenue trends chart
  - Top products chart
  - Professional color palette for charts

- **Product Management**
  - Create, edit, and delete products
  - Manage product images
  - Set prices and stock
  - Assign categories

- **Order Management**
  - View all orders
  - Update order status
  - Filter and search orders

- **User Management**
  - View all users
  - Toggle user roles (admin/customer)
  - Manage user status

- **Category Management**
  - Create, edit, and delete categories
  - Organize products by category

## Tech Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Routing**: React Router
- **State Management**: React Context API
- **Charts**: Recharts

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── api/
│   └── axios.js          # Axios instance with base URL
├── components/
│   ├── Footer.jsx        # Footer component
│   ├── Navbar.jsx        # Navigation bar
│   └── ProductCard.jsx   # Product card component
├── context/
│   ├── AuthContext.jsx   # Authentication context
│   └── CartContext.jsx   # Shopping cart context
├── pages/
│   ├── admin/
│   │   ├── AdminCategories.jsx
│   │   ├── AdminOrders.jsx
│   │   ├── AdminProducts.jsx
│   │   ├── AdminUsers.jsx
│   │   ├── Dashboard.jsx
│   │   └── AdminLayout.jsx
│   ├── Cart.jsx          # Shopping cart page
│   ├── Checkout.jsx      # Checkout page
│   ├── Login.jsx         # Login page
│   ├── Orders.jsx        # Order history page
│   ├── PaymentResult.jsx # Payment result page
│   ├── Products.jsx      # Products listing page
│   ├── ProductDetails.jsx # Product details page
│   └── Register.jsx      # Registration page
├── utils/
│   └── format.js         # Utility functions (currency, error messages)
├── App.jsx               # Main app component
├── index.css             # Global styles
└── main.jsx              # Entry point
```

## API Integration

The frontend connects to a Laravel backend API. Configure the API base URL in `src/api/axios.js`:

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
})
```

## Environment Variables

Create a `.env` file in the root directory:

```
VITE_API_URL=http://your-backend-api-url
```

## Key Features Implementation

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Adaptive layouts for all screen sizes

### Payment Flow
1. User adds products to cart
2. Proceeds to checkout
3. Enters shipping details
4. Selects payment method
5. Order created
6. Redirected to Orders page
7. Clicks "Pay Now" on unpaid order
8. Selects payment method from modal
9. Enters payment details (card/wallet)
10. Payment processed
11. Success message displayed

### Optimistic UI Updates
- Cart quantity changes update immediately
- API calls happen in background
- Reverts on error

### Error Handling
- User-friendly error messages
- Form validation
- API error handling with fallback messages

## License

MIT
