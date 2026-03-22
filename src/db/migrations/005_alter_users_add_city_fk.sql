ALTER TABLE users
  ADD CONSTRAINT fk_users_city
  FOREIGN KEY (city_id) REFERENCES cities(id);
