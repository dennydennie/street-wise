import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A named spot reports are aggregated into (an intersection or a stretch of
 * road). A report joins the nearest area within 200 m, otherwise a new one is
 * created at the report's position.
 */
@Index('IDX_areas_lat_lng', ['lat', 'lng'])
@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
