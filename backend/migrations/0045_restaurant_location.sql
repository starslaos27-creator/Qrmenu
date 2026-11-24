alter table restaurants
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add constraint restaurants_coordinates_pair_check
    check ((latitude is null) = (longitude is null));

alter table restaurants
  drop constraint if exists restaurants_coordinates_range_check;

alter table restaurants
  add constraint restaurants_coordinates_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint restaurants_longitude_range_check
    check (longitude is null or longitude between -180 and 180);
