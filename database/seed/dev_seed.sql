INSERT INTO users (name, email, phone, password_hash, role, is_verified)
VALUES
('Test Citizen', 'citizen@test.com', '9999999999', 'hashed_password', 'CITIZEN', true),
('Test Officer', 'officer@test.com', '8888888888', 'hashed_password', 'OFFICER', true),
('Test Admin', 'admin@test.com', '7777777777', 'hashed_password', 'ADMIN', true);

INSERT INTO issues (
    title,
    description,
    category,
    status,
    severity,
    priority_score,
    latitude,
    longitude,
    address,
    reported_by
)
VALUES (
    'Large pothole near main road',
    'Dangerous pothole causing traffic slowdown',
    'POTHOLE',
    'REPORTED',
    'HIGH',
    85.50,
    12.97159870,
    77.59456600,
    'MG Road, Bengaluru',
    (SELECT id FROM users WHERE email = 'citizen@test.com')
);