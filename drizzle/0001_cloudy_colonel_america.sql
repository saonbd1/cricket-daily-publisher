CREATE TABLE `fixtures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(128) NOT NULL,
	`tournamentId` int NOT NULL,
	`teamOne` varchar(160) NOT NULL,
	`teamTwo` varchar(160) NOT NULL,
	`venue` varchar(255),
	`startTimeUtc` timestamp NOT NULL,
	`localDateGmt6` varchar(10) NOT NULL,
	`localTimeGmt6` varchar(5) NOT NULL,
	`status` enum('scheduled','live','completed','postponed','cancelled') NOT NULL DEFAULT 'scheduled',
	`scoreSummary` text,
	`matchUrl` text,
	`bloggerPostId` varchar(128),
	`bloggerPostUrl` text,
	`firstPublishedAt` timestamp,
	`lastPublishedAt` timestamp,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixtures_id` PRIMARY KEY(`id`),
	CONSTRAINT `fixtures_externalId_unique` UNIQUE(`externalId`),
	CONSTRAINT `fixtures_external_id_idx` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `publisher_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trigger` enum('scheduled','manual') NOT NULL,
	`status` enum('running','success','partial','failed') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`fixturesFetched` int NOT NULL DEFAULT 0,
	`postsCreated` int NOT NULL DEFAULT 0,
	`postsUpdated` int NOT NULL DEFAULT 0,
	`apiStatusCode` int,
	`bloggerStatusCode` int,
	`errorMessage` text,
	CONSTRAINT `publisher_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publisher_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blogId` varchar(128) NOT NULL,
	`blogUrl` text NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`lastRunStatus` enum('success','partial','failed'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `publisher_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `publisher_settings_blogId_unique` UNIQUE(`blogId`)
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalizedName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournaments_name_unique` UNIQUE(`name`),
	CONSTRAINT `tournaments_normalizedName_unique` UNIQUE(`normalizedName`)
);
