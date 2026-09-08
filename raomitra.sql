-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 08, 2026 at 12:40 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `raomitra`
--

-- --------------------------------------------------------

--
-- Table structure for table `app_sessions`
--

CREATE TABLE `app_sessions` (
  `id` varchar(128) NOT NULL,
  `data` longblob NOT NULL,
  `expires_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `app_sessions`
--

INSERT INTO `app_sessions` (`id`, `data`, `expires_at`) VALUES
('05516k39mnum79mr0bq8mq8527', '', 1788275823),
('3urstlnd06m6u4ieckk6rc7vv8', 0x757365725f69647c693a353b, 1788275506),
('8djdcadk5jsp0pstb0btefj5pk', '', 1788865397),
('8g9321e0mg5339lsplgmpfgb92', '', 1788276299),
('8u11pumthsd2cn5qvuhbve228j', '', 1788275526),
('c2qsjfosl88j101mtke1i842o2', '', 1788865293),
('h0il72835rr4bejtd2caschf3q', '', 1788276299),
('ssmv0gp7afbneko5369semijdb', 0x757365725f69647c693a353b, 1788276364),
('t921fhn133egh3dc6i7oljs4a9', '', 1788865150),
('tocj1dbja1f4a3p0kalmleccu4', 0x757365725f69647c693a353b, 1788275567);

-- --------------------------------------------------------

--
-- Table structure for table `community_posts`
--

CREATE TABLE `community_posts` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `community_replies`
--

CREATE TABLE `community_replies` (
  `id` int(10) UNSIGNED NOT NULL,
  `post_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `host_applications`
--

CREATE TABLE `host_applications` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `listing_type` enum('host','vehicle') NOT NULL DEFAULT 'host',
  `city` varchar(120) NOT NULL,
  `country` varchar(120) NOT NULL DEFAULT 'India',
  `phone` varchar(40) NOT NULL,
  `bio` text NOT NULL,
  `experience` varchar(80) DEFAULT NULL,
  `vehicle_info` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `review_note` varchar(255) DEFAULT NULL,
  `reviewed_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `host_applications`
--

INSERT INTO `host_applications` (`id`, `user_id`, `listing_type`, `city`, `country`, `phone`, `bio`, `experience`, `vehicle_info`, `status`, `review_note`, `reviewed_by`, `created_at`, `updated_at`) VALUES
(3, 7, 'host', 'nagpur', 'India', '1234567890', 'sadasdasdasdasdsaddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'new', NULL, 'pending', NULL, NULL, '2026-08-31 17:04:15', '2026-08-31 17:04:15');

-- --------------------------------------------------------

--
-- Table structure for table `itineraries`
--

CREATE TABLE `itineraries` (
  `id` int(10) UNSIGNED NOT NULL,
  `trip_id` int(10) UNSIGNED NOT NULL,
  `version` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `itinerary_json` longtext NOT NULL,
  `summary` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `itineraries`
--

INSERT INTO `itineraries` (`id`, `trip_id`, `version`, `is_current`, `itinerary_json`, `summary`, `created_at`) VALUES
(5, 3, 1, 1, '{\"destination\":\"bali\",\"version\":1,\"generated_at\":\"2026-08-27T13:43:52+00:00\",\"party\":{\"traveling_with\":\"couple\",\"group_size\":2},\"arrival_time\":\"morning\",\"departure_time\":\"afternoon\",\"days\":[{\"day\":1,\"date\":\"2026-08-28\",\"theme\":\"Arrive & get oriented\",\"window\":{\"start\":\"10:00\",\"end\":\"20:00\",\"kind\":\"arrival_morning\"},\"activities\":[{\"id\":\"act_3998e2ce6e\",\"time\":\"10:00\",\"end_time\":\"11:30\",\"title\":\"Revolver Espresso\",\"place\":\"Revolver Espresso\",\"category\":\"cafe\",\"cost_estimate\":12,\"notes\":\"Typical hours: 07:00-16:00\"},{\"id\":\"act_e4340bc51e\",\"time\":\"12:00\",\"end_time\":\"13:30\",\"title\":\"Warung Babi Guling Ibu Oka\",\"place\":\"Warung Babi Guling Ibu Oka\",\"category\":\"restaurant\",\"cost_estimate\":16,\"notes\":\"Typical hours: 11:00-18:00\"},{\"id\":\"act_cba3d14b7d\",\"time\":\"14:00\",\"end_time\":\"15:30\",\"title\":\"Canggu Cafe Hopping\",\"place\":\"Canggu Cafe Hopping\",\"category\":\"cafe\",\"cost_estimate\":36,\"notes\":\"Typical hours: 08:00-17:00\"},{\"id\":\"act_71440c7dde\",\"time\":\"16:00\",\"end_time\":\"17:30\",\"title\":\"Tegallalang Rice Terraces\",\"place\":\"Tegallalang Rice Terraces\",\"category\":\"nature\",\"cost_estimate\":20,\"notes\":\"Typical hours: 07:00-18:00\"}]},{\"day\":2,\"date\":\"2026-08-29\",\"theme\":\"Explore bali\",\"window\":{\"start\":\"09:00\",\"end\":\"20:00\",\"kind\":\"full\"},\"activities\":[{\"id\":\"act_a60cca88bb\",\"time\":\"09:00\",\"end_time\":\"10:30\",\"title\":\"Ubud Sacred Monkey Forest\",\"place\":\"Ubud Sacred Monkey Forest\",\"category\":\"nature\",\"cost_estimate\":16,\"notes\":\"Typical hours: 08:30-18:00\"},{\"id\":\"act_2f3a56ce75\",\"time\":\"11:00\",\"end_time\":\"12:30\",\"title\":\"Seminyak Beach Walk\",\"place\":\"Seminyak Beach Walk\",\"category\":\"beach\",\"cost_estimate\":0,\"notes\":\"Typical hours: 06:00-19:00\"},{\"id\":\"act_24c07d852a\",\"time\":\"13:00\",\"end_time\":\"14:30\",\"title\":\"Tirta Empul Temple\",\"place\":\"Tirta Empul Temple\",\"category\":\"temple\",\"cost_estimate\":24,\"notes\":\"Typical hours: 08:00-18:00\"},{\"id\":\"act_bae2026a97\",\"time\":\"15:00\",\"end_time\":\"16:30\",\"title\":\"Uluwatu Temple\",\"place\":\"Uluwatu Temple\",\"category\":\"temple\",\"cost_estimate\":30,\"notes\":\"Typical hours: 09:00-19:00\"}]},{\"day\":3,\"date\":\"2026-08-30\",\"theme\":\"Explore bali\",\"window\":{\"start\":\"09:00\",\"end\":\"20:00\",\"kind\":\"full\"},\"activities\":[{\"id\":\"act_10d61fd0e6\",\"time\":\"09:00\",\"end_time\":\"10:30\",\"title\":\"Ubud Art Market\",\"place\":\"Ubud Art Market\",\"category\":\"market\",\"cost_estimate\":40,\"notes\":\"Typical hours: 08:00-18:00\"},{\"id\":\"act_362f05f4f5\",\"time\":\"11:00\",\"end_time\":\"12:30\",\"title\":\"Nusa Penida Day Trip\",\"place\":\"Nusa Penida Day Trip\",\"category\":\"adventure\",\"cost_estimate\":90,\"notes\":\"Typical hours: 07:00-17:00\"},{\"id\":\"act_f53908b1d5\",\"time\":\"13:00\",\"end_time\":\"14:30\",\"title\":\"Jimbaran Seafood Dinner\",\"place\":\"Jimbaran Seafood Dinner\",\"category\":\"restaurant\",\"cost_estimate\":70,\"notes\":\"Typical hours: 17:00-22:00\"},{\"id\":\"act_463d62134c\",\"time\":\"15:00\",\"end_time\":\"16:30\",\"title\":\"Tanah Lot Sunset\",\"place\":\"Tanah Lot Sunset\",\"category\":\"temple\",\"cost_estimate\":24,\"notes\":\"Typical hours: 16:00-19:00\"}]},{\"day\":4,\"date\":\"2026-08-31\",\"theme\":\"Explore bali\",\"window\":{\"start\":\"09:00\",\"end\":\"20:00\",\"kind\":\"full\"},\"activities\":[]},{\"day\":5,\"date\":\"2026-09-01\",\"theme\":\"Explore bali\",\"window\":{\"start\":\"09:00\",\"end\":\"20:00\",\"kind\":\"full\"},\"activities\":[]},{\"day\":6,\"date\":\"2026-09-02\",\"theme\":\"Departure day\",\"window\":{\"start\":\"08:00\",\"end\":\"13:00\",\"kind\":\"depart_afternoon\"},\"activities\":[]}],\"budget\":{\"user_budget\":10,\"currency\":\"USD\",\"estimated_total\":972,\"per_person\":486,\"breakdown\":{\"activities\":378,\"accommodation\":210,\"food\":189,\"local_transport\":195},\"within_budget\":false},\"accommodation\":{\"type\":\"Boutique hotel \\/ apartment (budget-focused)\",\"nightly\":42,\"recommendation\":\"Boutique hotel \\/ apartment (budget-focused) near the city center of bali\",\"reason\":\"Couples typically prefer a quiet boutique stay near the center.\"},\"transportation\":{\"local\":\"Metro plus occasional taxi for evenings\",\"airport\":\"Airport express or pre-booked cab\",\"local_total\":195,\"note\":\"Estimates scale with party size and trip length.\"},\"weather_note\":\"If rain is expected, swap outdoor viewpoints for museums, markets, and cafés. Ask the assistant to adjust for weather.\",\"summary\":\"6-day plan for couple in bali (moderate, party of 2). Arrival: Morning. Departure: Afternoon.\"}', '6-day plan for couple in bali (moderate, party of 2). Arrival: Morning. Departure: Afternoon.', '2026-08-27 13:43:52');

-- --------------------------------------------------------

--
-- Table structure for table `itinerary_messages`
--

CREATE TABLE `itinerary_messages` (
  `id` int(10) UNSIGNED NOT NULL,
  `trip_id` int(10) UNSIGNED NOT NULL,
  `itinerary_id` int(10) UNSIGNED DEFAULT NULL,
  `role` enum('user','assistant') NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `type` varchar(40) NOT NULL,
  `title` varchar(180) NOT NULL,
  `body` text DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `body`, `link`, `is_read`, `created_at`) VALUES
(8, 4, 'community', 'Welcome to Roamitra', 'Your account is ready. Plan a trip, join the community, or try the translator.', 'planner.html', 0, '2026-08-27 09:49:01'),
(11, 5, 'booking', 'New vehicle booking', 'E2E Tester booked Honda Activa 6G.', 'admin.html', 0, '2026-08-27 10:11:28'),
(13, 5, 'host', 'New host application', 'E2E Tester applied to become a host in Bangalore.', 'admin.html', 0, '2026-08-27 10:12:00'),
(17, 5, 'host', 'New host request', 'Host Requester asked to become a host in Mysore.', 'admin.html', 1, '2026-08-27 10:39:26'),
(19, 5, 'itinerary', 'Itinerary generated', 'Your bali itinerary is ready.', 'itinerary.html?trip=3', 0, '2026-08-27 13:43:52'),
(20, 4, 'booking', 'Booking confirmed', 'Honda Activa 6G is reserved for 2 day(s). Total $16.00.', 'profile.html', 0, '2026-08-31 09:15:30'),
(21, 5, 'booking', 'New vehicle booking', 'test booked Honda Activa 6G.', 'admin.html', 0, '2026-08-31 09:15:30'),
(22, 7, 'community', 'Welcome to Roamitra', 'Your account is ready. Plan a trip, join the community, or try the translator.', 'planner.html', 0, '2026-08-31 16:54:26'),
(23, 7, 'host', 'Host request sent to admin', 'Your Become a Host request is now in the admin dashboard for review.', 'host.html', 0, '2026-08-31 17:04:15'),
(24, 5, 'host', 'New host request', 'test asked to become a host in nagpur.', 'admin.html', 0, '2026-08-31 17:04:15');

-- --------------------------------------------------------

--
-- Table structure for table `translator_history`
--

CREATE TABLE `translator_history` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `source_lang` varchar(16) NOT NULL,
  `target_lang` varchar(16) NOT NULL,
  `source_text` text NOT NULL,
  `translated_text` text NOT NULL,
  `mode` enum('text','voice') NOT NULL DEFAULT 'text',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `translator_prefs`
--

CREATE TABLE `translator_prefs` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `source_lang` varchar(16) NOT NULL DEFAULT 'en',
  `target_lang` varchar(16) NOT NULL DEFAULT 'hi'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trips`
--

CREATE TABLE `trips` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `destination` varchar(180) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `budget` decimal(12,2) DEFAULT NULL,
  `budget_currency` varchar(8) NOT NULL DEFAULT 'USD',
  `traveling_with` enum('solo','couple','family','friends','group') NOT NULL DEFAULT 'solo',
  `group_size` tinyint(3) UNSIGNED DEFAULT NULL,
  `arrival_time` enum('morning','afternoon','evening','late_night') DEFAULT NULL,
  `departure_time` enum('morning','afternoon','evening','late_night') DEFAULT NULL,
  `preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferences`)),
  `pace` enum('relaxed','moderate','packed') NOT NULL DEFAULT 'moderate',
  `status` enum('draft','generated','saved') NOT NULL DEFAULT 'draft',
  `is_saved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `trips`
--

INSERT INTO `trips` (`id`, `user_id`, `destination`, `start_date`, `end_date`, `budget`, `budget_currency`, `traveling_with`, `group_size`, `arrival_time`, `departure_time`, `preferences`, `pace`, `status`, `is_saved`, `created_at`, `updated_at`) VALUES
(3, 5, 'bali', '2026-08-28', '2026-09-02', 10.00, 'USD', 'couple', 2, 'morning', 'afternoon', '[\"food\"]', 'moderate', 'generated', 0, '2026-08-27 13:43:52', '2026-08-27 13:43:52');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('customer','host','co_admin','admin') NOT NULL DEFAULT 'customer',
  `avatar_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `role`, `avatar_url`, `created_at`, `updated_at`) VALUES
(4, 'test', 'test@gmail.com', '$2y$10$s6S9t/GWzJJfy6ezRpnNlu/wCg2ES34z0UcN6B/2otaXXuxvtyeU.', 'customer', NULL, '2026-08-27 09:49:01', '2026-08-27 09:49:01'),
(5, 'Roamitra Admin', 'admin@raomitra.com', '$2y$10$10JIhdG7yRQZwzpmvU79DOCoGFQpwgSltWhEpknoiMKgvvSWowsf2', 'admin', NULL, '2026-08-27 10:03:57', '2026-08-31 16:52:33'),
(7, 'test', 'test1@gmail.com', '$2y$10$QCj0VugoOyL8C1ioH.GZ2eCD9Gj1JNt0lPh3qkf2sY6LSV9ST72qy', 'customer', NULL, '2026-08-31 16:54:26', '2026-08-31 16:54:26');

-- --------------------------------------------------------

--
-- Table structure for table `vehicle_bookings`
--

CREATE TABLE `vehicle_bookings` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `vehicle_name` varchar(180) NOT NULL,
  `category` varchar(40) DEFAULT NULL,
  `location` varchar(180) DEFAULT NULL,
  `daily_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `days` smallint(5) UNSIGNED NOT NULL DEFAULT 1,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `notes` varchar(255) DEFAULT NULL,
  `status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vehicle_bookings`
--

INSERT INTO `vehicle_bookings` (`id`, `user_id`, `vehicle_name`, `category`, `location`, `daily_rate`, `start_date`, `end_date`, `days`, `total`, `notes`, `status`, `created_at`) VALUES
(2, 4, 'Honda Activa 6G', 'scooters', 'Bangalore, India', 8.00, '2026-08-31', '2026-09-01', 2, 16.00, NULL, 'confirmed', '2026-08-31 09:15:30');

-- --------------------------------------------------------

--
-- Table structure for table `wallets`
--

CREATE TABLE `wallets` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(8) NOT NULL DEFAULT 'USD',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `wallets`
--

INSERT INTO `wallets` (`id`, `user_id`, `balance`, `currency`, `updated_at`) VALUES
(4, 4, 0.00, 'USD', '2026-08-27 09:49:01'),
(5, 5, 0.00, 'USD', '2026-08-27 10:03:57'),
(7, 7, 0.00, 'USD', '2026-08-31 16:54:26');

-- --------------------------------------------------------

--
-- Table structure for table `wallet_transactions`
--

CREATE TABLE `wallet_transactions` (
  `id` int(10) UNSIGNED NOT NULL,
  `wallet_id` int(10) UNSIGNED NOT NULL,
  `type` enum('credit','debit') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `description` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `app_sessions`
--
ALTER TABLE `app_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_app_sessions_expires` (`expires_at`);

--
-- Indexes for table `community_posts`
--
ALTER TABLE `community_posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_community_posts_user` (`user_id`);

--
-- Indexes for table `community_replies`
--
ALTER TABLE `community_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_community_replies_post` (`post_id`),
  ADD KEY `fk_community_replies_user` (`user_id`);

--
-- Indexes for table `host_applications`
--
ALTER TABLE `host_applications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_host_apps_user` (`user_id`),
  ADD KEY `idx_host_apps_status` (`status`,`created_at`);

--
-- Indexes for table `itineraries`
--
ALTER TABLE `itineraries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_trip_version` (`trip_id`,`version`),
  ADD KEY `idx_itineraries_current` (`trip_id`,`is_current`);

--
-- Indexes for table `itinerary_messages`
--
ALTER TABLE `itinerary_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_itinerary_messages_trip` (`trip_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`,`is_read`,`created_at`);

--
-- Indexes for table `translator_history`
--
ALTER TABLE `translator_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_translator_user` (`user_id`,`created_at`);

--
-- Indexes for table `translator_prefs`
--
ALTER TABLE `translator_prefs`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `trips`
--
ALTER TABLE `trips`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_trips_user` (`user_id`),
  ADD KEY `idx_trips_saved` (`user_id`,`is_saved`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_users_email` (`email`);

--
-- Indexes for table `vehicle_bookings`
--
ALTER TABLE `vehicle_bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bookings_user` (`user_id`,`created_at`);

--
-- Indexes for table `wallets`
--
ALTER TABLE `wallets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_wallets_user` (`user_id`);

--
-- Indexes for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wallet_tx` (`wallet_id`,`created_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `community_posts`
--
ALTER TABLE `community_posts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `community_replies`
--
ALTER TABLE `community_replies`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `host_applications`
--
ALTER TABLE `host_applications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `itineraries`
--
ALTER TABLE `itineraries`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `itinerary_messages`
--
ALTER TABLE `itinerary_messages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `translator_history`
--
ALTER TABLE `translator_history`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `trips`
--
ALTER TABLE `trips`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `vehicle_bookings`
--
ALTER TABLE `vehicle_bookings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `wallets`
--
ALTER TABLE `wallets`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `community_posts`
--
ALTER TABLE `community_posts`
  ADD CONSTRAINT `fk_community_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `community_replies`
--
ALTER TABLE `community_replies`
  ADD CONSTRAINT `fk_community_replies_post` FOREIGN KEY (`post_id`) REFERENCES `community_posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_community_replies_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `host_applications`
--
ALTER TABLE `host_applications`
  ADD CONSTRAINT `fk_host_apps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `itineraries`
--
ALTER TABLE `itineraries`
  ADD CONSTRAINT `fk_itineraries_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `itinerary_messages`
--
ALTER TABLE `itinerary_messages`
  ADD CONSTRAINT `fk_itinerary_messages_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `translator_history`
--
ALTER TABLE `translator_history`
  ADD CONSTRAINT `fk_translator_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `translator_prefs`
--
ALTER TABLE `translator_prefs`
  ADD CONSTRAINT `fk_translator_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `trips`
--
ALTER TABLE `trips`
  ADD CONSTRAINT `fk_trips_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `vehicle_bookings`
--
ALTER TABLE `vehicle_bookings`
  ADD CONSTRAINT `fk_bookings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `wallets`
--
ALTER TABLE `wallets`
  ADD CONSTRAINT `fk_wallets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD CONSTRAINT `fk_wallet_tx_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
