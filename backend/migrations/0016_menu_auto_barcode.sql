create sequence menu_barcode_numbers;
create function assign_menu_barcode() returns trigger language plpgsql as $$
begin
  if new.track_stock and nullif(btrim(new.stock_barcode), '') is null then
    loop
      new.stock_barcode := 'M' || lpad(nextval('menu_barcode_numbers')::text, 12, '0');
      exit when not exists (select 1 from menus where stock_barcode = new.stock_barcode);
    end loop;
  end if;
  return new;
end;
$$;
create trigger menu_auto_barcode before insert or update of track_stock, stock_barcode on menus
for each row execute function assign_menu_barcode();
