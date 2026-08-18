ALTER TABLE `fixtures` ADD COLUMN `verificationStatus` varchar(16) NOT NULL DEFAULT 'verified';
ALTER TABLE `fixtures` ADD COLUMN `sourceEvidence` text;
