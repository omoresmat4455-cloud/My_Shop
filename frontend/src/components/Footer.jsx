import { Link } from 'react-router-dom'
import {
    Mail,
    Phone,
    MapPin,
    Share2,
    Heart,
    MessageCircle,
} from 'lucide-react'

export default function Footer() {
    return (
        <footer className="bg-gray-900 text-gray-300 mt-auto">
            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="grid md:grid-cols-4 gap-8">

                    {/* Brand Section */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-2 mb-4 group">
                            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:shadow-md transition-all duration-200">
                                M
                            </div>
                            <span className="font-bold text-2xl text-white">MyShop</span>
                        </div>

                        <p className="text-sm text-gray-400 leading-relaxed">
                            Your trusted online store for quality products at
                            great prices. Shop with confidence.
                        </p>

                        <div className="flex gap-3 mt-6">
                            <a
                                href="#"
                                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
                                title="Share"
                                aria-label="Share"
                            >
                                <Share2 className="w-5 h-5" />
                            </a>

                            <a
                                href="#"
                                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
                                title="Contact"
                                aria-label="Contact"
                            >
                                <MessageCircle className="w-5 h-5" />
                            </a>

                            <a
                                href="#"
                                className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
                                title="Follow"
                                aria-label="Follow"
                            >
                                <Heart className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-semibold text-white mb-4 text-lg">
                            Quick Links
                        </h3>

                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link
                                    to="/"
                                    className="hover:text-primary-400 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                                    Home
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/cart"
                                    className="hover:text-primary-400 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                                    Cart
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="/orders"
                                    className="hover:text-primary-400 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                                    My Orders
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Customer Service */}
                    <div>
                        <h3 className="font-semibold text-white mb-4 text-lg">
                            Customer Service
                        </h3>

                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-3 hover:text-primary-400 transition-colors">
                                <Phone className="w-4 h-4 text-primary-500" />
                                <span>+20 1XX XXX XXXX</span>
                            </li>

                            <li className="flex items-center gap-3 hover:text-primary-400 transition-colors">
                                <Mail className="w-4 h-4 text-primary-500" />
                                <span>support@myshop.com</span>
                            </li>

                            <li className="flex items-center gap-3 hover:text-primary-400 transition-colors">
                                <MapPin className="w-4 h-4 text-primary-500" />
                                <span>Cairo, Egypt</span>
                            </li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="font-semibold text-white mb-4 text-lg">
                            Legal
                        </h3>

                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link
                                    to="#"
                                    className="hover:text-primary-400 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                                    Privacy Policy
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="#"
                                    className="hover:text-primary-400 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                                    Terms of Service
                                </Link>
                            </li>

                            <li>
                                <Link
                                    to="#"
                                    className="hover:text-primary-400 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                                    Return Policy
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright & Developer */}
                <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-500">
                    <p>&copy; {new Date().getFullYear()} MyShop. All rights reserved.</p>

                    <p className="mt-3">
                        Designed & Developed by{' '}
                        <span className="inline-block font-semibold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent hover:scale-105 transition-transform duration-300">
                            Omar Esmat
                        </span>
                    </p>
                </div>
            </div>
        </footer>
    )
}
 
